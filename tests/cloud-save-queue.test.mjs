import assert from "node:assert/strict";
import test from "node:test";
import { createLatestTaskQueue } from "../src/lib/latestTaskQueue.ts";
import { fetchJourneyJson, JourneyHttpError } from "../src/lib/journeyTransport.ts";
import { beginCloudJourneyRestore, clearJourneySessionToken, getJourneySessionToken, saveCloudJourney, setJourneySessionToken } from "../src/lib/cloudJourneyClient.ts";
import { readBrowserStorage, writeBrowserStorage, removeBrowserStorage } from "../src/lib/safeStorage.ts";

function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; }
function browser(t, storage) {
  const before = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: { localStorage: storage, atob: globalThis.atob } });
  t.after(() => { clearJourneySessionToken(); if (before) Object.defineProperty(globalThis, "window", before); else delete globalThis.window; });
}
function memoryStorage() { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) }; }

test("only one request runs at once and intermediate pending snapshots are superseded", async () => {
  const gate = deferred(), calls = [];
  const queue = createLatestTaskQueue(async value => { calls.push(value); if (value === 1) await gate.promise; return value; });
  const first = queue.enqueue(1), second = queue.enqueue(2), third = queue.enqueue(3);
  assert.deepEqual(calls, [1]); assert.deepEqual(await second, { status: "superseded" });
  gate.resolve();
  assert.deepEqual(await first, { status: "written", value: 1 });
  assert.deepEqual(await third, { status: "written", value: 3 });
  assert.deepEqual(calls, [1, 3]);
});
test("a failed write does not block the newest pending snapshot", async () => {
  const gate = deferred();
  const queue = createLatestTaskQueue(async value => { if (value === 1) await gate.promise; return value; });
  const first = queue.enqueue(1), failed = assert.rejects(first, /offline/), last = queue.enqueue(2);
  gate.reject(new Error("offline")); await failed;
  assert.deepEqual(await last, { status: "written", value: 2 });
});
test("many pending writes remain bounded to the latest snapshot", async () => {
  const gate = deferred(), calls = [];
  const queue = createLatestTaskQueue(async value => { calls.push(value); if (!value) await gate.promise; return value; });
  const jobs = Array.from({ length: 100 }, (_, i) => queue.enqueue(i));
  gate.resolve(); const results = await Promise.all(jobs);
  assert.deepEqual(calls, [0, 99]); assert.equal(results.filter(x => x.status === "superseded").length, 98);
});
test("storage getter and method failures are contained", t => {
  browser(t, { getItem() { throw new Error("denied"); }, setItem() { throw new Error("quota"); }, removeItem() { throw new Error("denied"); } });
  assert.equal(readBrowserStorage("key"), null); assert.equal(writeBrowserStorage("key", "value"), false); assert.equal(removeBrowserStorage("key"), false);
  Object.defineProperty(window, "localStorage", { get() { throw new Error("denied at getter"); } });
  assert.equal(readBrowserStorage("key"), null); assert.equal(writeBrowserStorage("key", "value"), false);
  setJourneySessionToken("memory-only"); assert.equal(getJourneySessionToken(), "memory-only");
  clearJourneySessionToken(); assert.equal(getJourneySessionToken(), null);
});
test("save jobs capture immutable request bodies and never reuse a changed account", async t => {
  browser(t, memoryStorage()); setJourneySessionToken("account-a");
  const gate = deferred(), calls = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => { calls.push(JSON.parse(init.body)); await gate.promise; return new Response('{"ok":true}'); });
  const snapshot = { activeEntryId: "fragment-001" };
  const first = saveCloudJourney(snapshot), second = saveCloudJourney({ activeEntryId: "fragment-002" });
  snapshot.activeEntryId = "changed-after-enqueue"; setJourneySessionToken("account-b"); gate.resolve();
  assert.deepEqual(await first, { ok: true }); assert.deepEqual(await second, { ok: false, skipped: true });
  assert.equal(calls.length, 1); assert.equal(calls[0].journey.activeEntryId, "fragment-001");
});
test("save API returns skipped for superseded snapshots rather than claiming they were saved", async t => {
  browser(t, memoryStorage()); setJourneySessionToken("account-a"); const gate = deferred(), calls = [];
  t.mock.method(globalThis, "fetch", async (_url, init) => { calls.push(init.body); if (calls.length === 1) await gate.promise; return new Response('{"ok":true}'); });
  const a = saveCloudJourney({ value: 1 }), b = saveCloudJourney({ value: 2 }), c = saveCloudJourney({ value: 3 });
  assert.deepEqual(await b, { ok: false, skipped: true }); gate.resolve();
  await a; await c; assert.deepEqual(calls.map(value => JSON.parse(value).journey.value), [1, 3]);
});
test("malformed successful responses and HTTP failures are not reported as saves", async t => {
  for (const [body, status] of [["not-json", 200], ['{"ok":false}', 200], ['{"error":"unauthorized"}', 401]]) {
    const mock = t.mock.method(globalThis, "fetch", async () => new Response(body, { status }));
    await assert.rejects(fetchJourneyJson("/api/save"), error => status === 401 ? error instanceof JourneyHttpError && error.status === 401 : /invalid response/.test(error.message));
    mock.mock.restore();
  }
});
test("cloud requests abort on timeout instead of leaving the queue permanently occupied", async t => {
  t.mock.method(globalThis, "fetch", async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  await assert.rejects(fetchJourneyJson("/api/save", {}, 5), /timed out/);
});
test("successful requests preserve authorization and forbid caching or redirects", async t => {
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers.get("authorization"), "Bearer fixed"); assert.equal(init.cache, "no-store"); assert.equal(init.redirect, "error");
    return new Response('{"ok":true}');
  });
  assert.deepEqual(await fetchJourneyJson("/api/save", { headers: { authorization: "Bearer fixed" } }), { ok: true });
});


test("magic-link verification remains staged until its current restore is accepted", async t => {
  browser(t, memoryStorage());
  t.mock.method(globalThis, "fetch", async () => new Response('{"ok":true,"sessionToken":"restored-account","journey":null}'));
  const restore = beginCloudJourneyRestore("magic-token");
  const payload = await restore.result;
  assert.equal(getJourneySessionToken(), null, "network completion cannot reconnect the account by itself");
  assert.equal(restore.accept(payload.sessionToken), true);
  assert.equal(getJourneySessionToken(), "restored-account");
  assert.equal(restore.accept(payload.sessionToken), false, "a completed restore cannot be accepted twice");
});

test("disconnecting or switching accounts while a magic-link request is pending discards its session", async t => {
  browser(t, memoryStorage());
  for (const change of [() => clearJourneySessionToken(), () => setJourneySessionToken("account-b")]) {
    setJourneySessionToken("account-a");
    const gate = deferred();
    const mock = t.mock.method(globalThis, "fetch", async () => { await gate.promise; return new Response('{"ok":true,"sessionToken":"restored-account"}'); });
    const restore = beginCloudJourneyRestore("magic-token");
    change();
    const expected = getJourneySessionToken();
    gate.resolve();
    const payload = await restore.result;
    assert.equal(restore.isCurrent(), false);
    assert.equal(restore.accept(payload.sessionToken), false);
    assert.equal(getJourneySessionToken(), expected);
    mock.mock.restore();
  }
});

test("disconnecting before an anonymous magic-link restore completes is respected", async t => {
  browser(t, memoryStorage());
  const gate = deferred();
  t.mock.method(globalThis, "fetch", async () => { await gate.promise; return new Response('{"ok":true,"sessionToken":"restored-account"}'); });
  const restore = beginCloudJourneyRestore("magic-token");
  clearJourneySessionToken();
  gate.resolve();
  const payload = await restore.result;
  assert.equal(restore.accept(payload.sessionToken), false, "a null-to-null disconnect still invalidates pending authentication");
  assert.equal(getJourneySessionToken(), null);
});

test("session restores capture the requested account and reject changed browser storage", async t => {
  const storage = memoryStorage();
  browser(t, storage); setJourneySessionToken("account-a");
  const gate = deferred();
  t.mock.method(globalThis, "fetch", async (_url, init) => {
    assert.equal(init.headers.get("authorization"), "Bearer account-a");
    await gate.promise;
    return new Response('{"ok":true,"journey":{"activeEntryId":"fragment-020"}}');
  });
  const restore = beginCloudJourneyRestore(null);
  storage.setItem("sidtw:session-token", "account-b");
  gate.resolve();
  const payload = await restore.result;
  assert.equal(restore.accept(payload.sessionToken), false);
  assert.equal(getJourneySessionToken(), "account-b");
});
