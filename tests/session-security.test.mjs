import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  sanitizeJourney,
  signSession,
  verifySession,
} from "../functions/_shared/session.ts";

test("the committed-secret scan includes the private content overlay directory", () => {
  const validator = fs.readFileSync(
    new URL("../scripts/validate-mobile-integration.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    validator,
    /const securityRoots = \["src", "functions", "\.github", "private-content"\]/,
  );
});

test("journey API sanitizer rejects malformed payloads and bounds arrays", () => {
  assert.equal(sanitizeJourney(null), null);
  assert.equal(sanitizeJourney({ activeEntryId: "fragment-001", history: "bad", visitedEntryIds: [] }), null);
  assert.equal(sanitizeJourney({ schemaVersion: 99, activeEntryId: "fragment-001", history: [], visitedEntryIds: [] }), null);
  const overlongHistory = Array.from(
    { length: 600 },
    (_, index) => `fragment-${String((index % 66) + 1).padStart(3, "0")}`,
  );

  const sanitized = sanitizeJourney({
    schemaVersion: 2,
    activeEntryId: "fragment-002",
    history: [42, ...overlongHistory],
    visitedEntryIds: ["fragment-001", "fragment-001", "fragment-002", "other", null],
    witnessedEntryIds: ["fragment-001", "unknown", "fragment-002"],
    completedRitualIds: ["ritual.accept-lantern", "../../bad"],
    worldFlags: { "path.first-wood-readable": true, "../../bad": true },
    landmarkStates: { "landmark.first-wood-lantern": "transformed", invalid: "destroyed" },
    resonances: { wolf: 900, swan: -4, seer: 42.4 },
    inventory: {
      lantern: true,
      recoveredKeys: ["key.self-permission", "../../bad"],
      symbolicObjects: ["memory.blue-moon"],
    },
    releasedWords: [" hope ", "HOPE", "\u0000grief"],
    completedActs: ["first-wood", "unknown"],
    completedChapterIds: ["broken-floor", "unknown"],
    completedSceneIds: ["broken-floor.confession", "unknown"],
    storyStarted: true,
    storyCompleted: true,
    updatedAt: "2026-07-27T00:00:00.000Z",
    unexpectedSecret: "must-not-survive",
  });

  assert.ok(sanitized);
  assert.equal(sanitized.schemaVersion, 2);
  assert.equal(sanitized.history.length, 512);
  assert.deepEqual(sanitized.history, overlongHistory.slice(0, 512));
  assert.deepEqual(sanitized.visitedEntryIds, ["fragment-001", "fragment-002"]);
  assert.deepEqual(sanitized.witnessedEntryIds, ["fragment-001", "fragment-002"]);
  assert.deepEqual(sanitized.completedRitualIds, ["ritual.accept-lantern"]);
  assert.deepEqual(sanitized.resonances, { wolf: 100, swan: 0, seer: 42 });
  assert.deepEqual(sanitized.releasedWords, ["hope", "grief"]);
  assert.equal(sanitized.storyCompleted, false, "completion requires all twelve chapters");
  assert.equal("unexpectedSecret" in sanitized, false);
});

test("journey API sanitizer retains a complete 66-fragment route with revisits", () => {
  const canonicalEntryIds = Array.from(
    { length: 66 },
    (_, index) => `fragment-${String(index + 1).padStart(3, "0")}`,
  );
  const completeRouteWithRevisits = [
    ...canonicalEntryIds,
    canonicalEntryIds[12],
    canonicalEntryIds[1],
    canonicalEntryIds[55],
    canonicalEntryIds[12],
  ];
  const activeEntryId = completeRouteWithRevisits.at(-1);
  const sanitized = sanitizeJourney({
    schemaVersion: 2,
    activeEntryId,
    history: completeRouteWithRevisits.slice(0, -1),
    visitedEntryIds: canonicalEntryIds,
  });

  assert.ok(sanitized);
  assert.deepEqual(
    [...sanitized.history, sanitized.activeEntryId],
    completeRouteWithRevisits,
    "cloud sanitization must preserve route order and repeated crossings",
  );
  assert.deepEqual(sanitized.visitedEntryIds, canonicalEntryIds);
});

test("legacy cloud navigation snapshots migrate into the bounded story schema", () => {
  const migrated = sanitizeJourney({
    activeEntryId: "fragment-018",
    history: ["fragment-001"],
    visitedEntryIds: ["fragment-001", "fragment-018"],
    updatedAt: "2026-07-27T00:00:00.000Z",
  });

  assert.ok(migrated);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.activeEntryId, "fragment-018");
  assert.equal(migrated.storyStarted, true);
  assert.deepEqual(migrated.completedRitualIds, []);
  assert.deepEqual(migrated.completedChapterIds, []);
});

test("session tokens verify only with the signing secret and reject tampering", async () => {
  const env = {
    MAGIC_LINK_SECRET: "mobile-integration-test-secret-with-enough-entropy",
    SESSION_MAX_AGE_DAYS: "30",
  };
  const token = await signSession(env, "reader@example.test");

  assert.equal(await verifySession(env, token), "reader@example.test");
  assert.equal(
    await verifySession({ ...env, MAGIC_LINK_SECRET: "different-mobile-integration-test-secret" }, token),
    null,
  );

  const [payload, signature] = token.split(".");
  assert.equal(await verifySession(env, `${payload}x.${signature}`), null);
});
