import assert from "node:assert/strict";
import test from "node:test";
import { onRequestPost } from "../functions/api/magic-link.ts";
import { readJsonRecord } from "../functions/_shared/requestBody.ts";
import { postMagicLinkEmail, secureDeliveryUrl } from "../functions/_shared/magicDelivery.ts";

function environment(extra = {}) {
  const put = [], deleted = [];
  return { put, deleted, env: {
    MAGIC_LINK_SECRET: "test-only-key", APP_ORIGIN: "https://story.test", EMAIL_WEBHOOK_URL: "https://mailer.test/send",
    SIDTW_MAGIC_KV: { put: async (...args) => put.push(args), delete: async key => deleted.push(key) }, ...extra,
  } };
}
function request(value = { email: " Reader@Example.com " }) {
  return new Request("https://story.test/api/magic-link", { method: "POST", body: JSON.stringify(value) });
}
test("missing production sender returns unavailable without minting a token", async () => {
  const context = environment({ EMAIL_WEBHOOK_URL: undefined });
  const response = await onRequestPost({ request: request(), env: context.env });
  assert.equal(response.status, 503); assert.equal(context.put.length, 0);
  assert.equal((await response.json()).ok, undefined);
});
test("development links require explicit opt-in and are never included after email delivery", async t => {
  const context = environment({ EMAIL_WEBHOOK_URL: undefined, ENABLE_DEV_MAGIC_LINK: "true" });
  const dev = await onRequestPost({ request: request(), env: context.env });
  assert.match((await dev.json()).devMagicLink, /^https:\/\/story.test\/\?sidtw_token=[a-f0-9]{64}$/);
  t.mock.method(globalThis, "fetch", async () => new Response("ok"));
  const production = await onRequestPost({ request: request(), env: environment({ ENABLE_DEV_MAGIC_LINK: "true" }).env });
  assert.deepEqual(await production.json(), { ok: true });
});
test("successful delivery normalizes recipient, bounds token lifetime and keeps responses uncached", async t => {
  const context = environment(); let delivery;
  t.mock.method(globalThis, "fetch", async (url, init) => {
    delivery = { url, init, body: JSON.parse(init.body) }; return new Response("ok");
  });
  const response = await onRequestPost({ request: request(), env: context.env });
  assert.equal(response.status, 200); assert.deepEqual(await response.json(), { ok: true });
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(delivery.body.to, "reader@example.com");
  assert.equal(delivery.init.redirect, "error"); assert.ok(delivery.init.signal);
  assert.equal(context.put[0][2].expirationTtl, 900); assert.equal(context.deleted.length, 0);
});
test("sender HTTP errors and network failures revoke the prepared token and return failure", async t => {
  for (const fail of [async () => new Response("no", { status: 500 }), async () => { throw new Error("network"); }]) {
    const context = environment(); const mock = t.mock.method(globalThis, "fetch", fail);
    const response = await onRequestPost({ request: request(), env: context.env });
    assert.equal(response.status, 502); assert.deepEqual(context.deleted, [context.put[0][0]]);
    assert.equal((await response.json()).ok, undefined); mock.mock.restore();
  }
});
test("an unresponsive sender is aborted within its configured time budget", async t => {
  t.mock.method(globalThis, "fetch", async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }));
  await assert.rejects(postMagicLinkEmail("https://mailer.test/send", {}, 5), /aborted/);
});
test("unsafe or malformed sender configuration fails before token creation", async () => {
  for (const url of ["http://mailer.test", "https://user:pass@mailer.test", "not-url"]) {
    const context = environment({ EMAIL_WEBHOOK_URL: url });
    assert.equal((await onRequestPost({ request: request(), env: context.env })).status, 503);
    assert.equal(context.put.length, 0);
  }
  assert.equal(secureDeliveryUrl("javascript:alert(1)"), null);
});
test("invalid email, null and array payloads cannot create tokens", async () => {
  for (const value of [{ email: "bad" }, { email: "x".repeat(260) + "@example.com" }, null, [], {}]) {
    const context = environment();
    assert.equal((await onRequestPost({ request: request(value), env: context.env })).status, 400);
    assert.equal(context.put.length, 0);
  }
});
test("malformed and oversize JSON get explicit errors", async () => {
  const context = environment();
  assert.equal((await onRequestPost({ request: new Request("https://story.test", { method: "POST", body: "{" }), env: context.env })).status, 400);
  assert.equal((await onRequestPost({ request: request({ email: "a@b.test", noise: "x".repeat(4096) }), env: context.env })).status, 413);
  assert.equal(context.put.length, 0);
});
test("streamed bodies are bounded even with a dishonest Content-Length", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) { controller.enqueue(new TextEncoder().encode('{"x":"' + "x".repeat(200))); },
    cancel() { cancelled = true; },
  });
  const input = new Request("https://story.test", { method: "POST", headers: { "content-length": "1" }, body, duplex: "half" });
  await assert.rejects(readJsonRecord(input, 32), error => error.status === 413);
  assert.equal(cancelled, true);
});
test("body budget counts UTF-8 bytes and rejects malformed encodings", async () => {
  await assert.rejects(readJsonRecord(request({ value: "é".repeat(20) }), 40), error => error.status === 413);
  const invalid = new Request("https://story.test", { method: "POST", body: new Uint8Array([123, 255, 125]) });
  await assert.rejects(readJsonRecord(invalid, 100), error => error.status === 400);
  assert.deepEqual(await readJsonRecord(request({ safe: true }), 100), { safe: true });
});
test("the save route keeps authentication and validates bounded JSON before writing", async () => {
  const { onRequestPost: save } = await import("../functions/api/save.ts");
  const { signSession } = await import("../functions/_shared/session.ts");
  const writes = [];
  const env = { MAGIC_LINK_SECRET: "save-test-key", SIDTW_JOURNEY_KV: { put: async (...args) => writes.push(args) } };
  assert.equal((await save({ env, request: request() })).status, 401);
  const token = await signSession(env, "reader@example.com");
  const authorized = value => new Request("https://story.test/api/save", {
    method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(value),
  });
  assert.equal((await save({ env, request: authorized([]) })).status, 400);
  assert.equal((await save({ env, request: authorized({ extra: "x".repeat(129 * 1024) }) })).status, 413);
  assert.equal(writes.length, 0);
  const response = await save({ env, request: authorized({ journey: {
    schemaVersion: 2, activeEntryId: "fragment-001", history: [], visitedEntryIds: ["fragment-001"],
  } }) });
  assert.equal(response.status, 200); assert.equal(writes.length, 1);
  assert.equal(writes[0][0], "journey:reader@example.com");
  assert.equal(JSON.parse(writes[0][1]).activeEntryId, "fragment-001");
});
