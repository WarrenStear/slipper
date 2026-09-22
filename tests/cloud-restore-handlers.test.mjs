import assert from "node:assert/strict";
import test from "node:test";
import { onRequestGet as load } from "../functions/api/load.ts";
import { onRequestGet as verify } from "../functions/api/verify.ts";
import { signSession, verifySession } from "../functions/_shared/session.ts";

const subject = "reader@example.test";
const magicToken = "a".repeat(64);
const validJourney = {
  schemaVersion: 2, activeEntryId: "fragment-008", history: ["fragment-001"],
  visitedEntryIds: ["fragment-001", "fragment-008"], updatedAt: "2025-01-01T00:00:00.000Z",
};

function environment(rawJourney) {
  const deleted = [], reads = [];
  const records = new Map([[`magic:${magicToken}`, { email: subject }]]);
  let journey = rawJourney;
  const env = {
    MAGIC_LINK_SECRET: "restore-handler-test-key",
    SIDTW_JOURNEY_KV: {
      async get(key) {
        reads.push(key);
        if (journey instanceof Error) throw journey;
        return journey;
      },
    },
    SIDTW_MAGIC_KV: {
      async get(key) { return records.get(key) ?? null; },
      async delete(key) { deleted.push(key); records.delete(key); },
    },
  };
  return { env, deleted, reads, setJourney(value) { journey = value; } };
}
async function loadRequest(env) {
  return new Request("https://story.test/api/load", {
    headers: { authorization: `Bearer ${await signSession(env, subject)}` },
  });
}
function verifyRequest() {
  return new Request(`https://story.test/api/verify?token=${magicToken}`);
}

for (const [label, handler, request] of [
  ["load", load, loadRequest],
  ["verify", verify, verifyRequest],
]) {
  test(`${label}: a genuinely absent journey is a successful empty restore`, async () => {
    const context = environment(null);
    const response = await handler({ env: context.env, request: await request(context.env) });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.journey, null);
    assert.deepEqual(context.reads, [`journey:${subject}`]);
    if (label === "verify") {
      assert.equal(await verifySession(context.env, payload.sessionToken), subject);
      assert.deepEqual(context.deleted, [`magic:${magicToken}`]);
    }
  });

  test(`${label}: valid and legacy cloud journeys remain restorable`, async () => {
    for (const schemaVersion of [2, 1, undefined]) {
      const context = environment(JSON.stringify({ ...validJourney, schemaVersion }));
      const response = await handler({ env: context.env, request: await request(context.env) });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.journey.activeEntryId, "fragment-008");
      assert.equal(payload.journey.schemaVersion, 2);
      assert.deepEqual(payload.journey.history, ["fragment-001"]);
    }
  });

  test(`${label}: stored but malformed, null, unsupported or invalid journeys fail closed`, async () => {
    for (const raw of ["", "{", "null", "[]", "{}", JSON.stringify({ ...validJourney, schemaVersion: 99 }), JSON.stringify({ ...validJourney, history: "invalid" })]) {
      const context = environment(raw);
      const response = await handler({ env: context.env, request: await request(context.env) });
      assert.equal(response.status, 409, `must reject stored ${JSON.stringify(raw)}`);
      assert.equal(response.headers.get("cache-control"), "no-store");
      const payload = await response.json();
      assert.match(payload.error, /unsupported or invalid format/);
      assert.equal(payload.ok, undefined);
      assert.equal(payload.journey, undefined, "an unreadable save cannot masquerade as a missing save");
      assert.equal(payload.sessionToken, undefined);
      assert.deepEqual(context.deleted, [], "failed restoration must not consume its magic link");
    }
  });
}

test("a failed magic-link restore can be retried after repairing the stored journey", async () => {
  const context = environment(JSON.stringify({ ...validJourney, schemaVersion: 99 }));
  const first = await verify({ env: context.env, request: verifyRequest() });
  assert.equal(first.status, 409);
  assert.deepEqual(context.deleted, []);
  context.setJourney(JSON.stringify(validJourney));
  const retried = await verify({ env: context.env, request: verifyRequest() });
  assert.equal(retried.status, 200);
  assert.equal((await retried.json()).journey.activeEntryId, "fragment-008");
  assert.deepEqual(context.deleted, [`magic:${magicToken}`]);
  assert.equal((await verify({ env: context.env, request: verifyRequest() })).status, 401);
});

test("a failed KV journey read does not consume the restore link", async () => {
  const context = environment(new Error("KV temporarily unavailable"));
  await assert.rejects(verify({ env: context.env, request: verifyRequest() }), /KV temporarily unavailable/);
  assert.deepEqual(context.deleted, []);
  context.setJourney(JSON.stringify(validJourney));
  assert.equal((await verify({ env: context.env, request: verifyRequest() })).status, 200);
});

test("load rejects missing authorization before reading any stored journey", async () => {
  const context = environment(JSON.stringify(validJourney));
  const response = await load({ env: context.env, request: new Request("https://story.test/api/load") });
  assert.equal(response.status, 401);
  assert.deepEqual(context.reads, []);
});
