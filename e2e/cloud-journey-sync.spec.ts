import { expect, test, type Page } from "@playwright/test";
import { journeyScenes } from "../src/data/journeyBlueprint";
import type { StoryJourneyState } from "../src/lib/storyJourneyState";
import { incompleteStoryJourney, JOURNEY_STORAGE_KEY, JOURNEY_STORAGE_VERSION } from "./story-first-fixtures";

const SESSION_KEY = "sidtw:session-token";
const session = Buffer.from(JSON.stringify({ sub: "reader@example.test", iat: Date.now() })).toString("base64url") + ".test-signature";
const remoteEntry = journeyScenes[1].keystoneEntryId;
function remoteJourney(updatedAt = "2025-01-01T00:00:00.000Z") {
  return {
    ...incompleteStoryJourney(),
    activeEntryId: remoteEntry,
    visitedEntryIds: ["fragment-001", remoteEntry],
    updatedAt,
    cloudSchemaVersion: 2,
    migratedFromNavigation: false,
  };
}
async function seedSession(page: Page) {
  await page.addInitScript(({ key, token }) => {
    localStorage.clear();
    localStorage.setItem(key, token);
  }, { key: SESSION_KEY, token: session });
}
async function currentEntry(page: Page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw).state.activeEntryId : null;
  }, JOURNEY_STORAGE_KEY);
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
async function currentSave(page: Page) {
  return page.evaluate(key => {
    const raw = localStorage.getItem(key);
    if (!raw) throw new Error("The persisted journey is missing.");
    return JSON.parse(raw) as {
      version: number;
      state: StoryJourneyState & {
        hasLocalJourney: boolean; bookmarkedEntryIds: string[];
        lastSafeEntryId: string; playerPosition: [number, number, number] | null;
      };
    };
  }, JOURNEY_STORAGE_KEY);
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("a retained session restores an older cloud journey when this device has no local save", async ({ page }) => {
  await seedSession(page);
  let loads = 0, saves = 0;
  await page.route("**/api/load", route => { loads += 1; return route.fulfill({ json: { ok: true, journey: remoteJourney() } }); });
  await page.route("**/api/save", route => { saves += 1; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/?accessible=1");
  await expect.poll(() => currentEntry(page)).toBe(remoteEntry);
  await expect(page.getByRole("button", { name: "Continue the Journey", exact: true })).toBeEnabled();
  await page.waitForTimeout(1_800);
  expect(loads).toBe(1);
  expect(saves).toBe(0);
});

test("failed restore allows local play but retries the read before enabling cloud writes", async ({ page }) => {
  await seedSession(page);
  let loads = 0, saves = 0;
  const retryGate = deferred();
  await page.route("**/api/load", async route => {
    loads += 1;
    if (loads === 1) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
    await retryGate.promise;
    return route.fulfill({ json: { ok: true, journey: remoteJourney("2099-01-01T00:00:00.000Z") } });
  });
  await page.route("**/api/save", route => { saves += 1; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/?accessible=1");
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeEnabled();
  await page.waitForTimeout(1_800);
  expect(saves).toBe(0);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => loads).toBe(2);
  await page.waitForTimeout(1_800);
  expect(saves).toBe(0);
  retryGate.resolve();
  await expect.poll(() => currentEntry(page)).toBe(remoteEntry);
  await expect(page.getByRole("button", { name: "Continue the Journey", exact: true })).toBeEnabled();
});

test("a late newer same-entry cloud restore returns local play to explicit Continue without mounting new progress", async ({ page }) => {
  await seedSession(page);
  const retryGate = deferred();
  let loads = 0;
  let newerJourney: ReturnType<typeof remoteJourney> | null = null;
  const writes: Array<StoryJourneyState & { cloudSchemaVersion: number }> = [];
  await page.route("**/api/load", async route => {
    loads += 1;
    if (loads === 1) return route.fulfill({ status: 503, json: { error: "Temporarily unavailable" } });
    await retryGate.promise;
    if (!newerJourney) throw new Error("The retry requires the actual locally begun snapshot.");
    return route.fulfill({ json: { ok: true, journey: newerJourney } });
  });
  await page.route("**/api/save", route => {
    writes.push(route.request().postDataJSON().journey);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/?accessible=1");
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeEnabled();
  expect(loads).toBe(1);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const opening = page.locator("[data-accessible-story-objects='broken-floor.confession']");
  await expect(opening).toBeVisible();
  await page.evaluate(() => new Promise<void>(resolve => {
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
  }));
  const begun = await currentSave(page);
  expect(begun.version).toBe(JOURNEY_STORAGE_VERSION);
  expect(begun.state.schemaVersion).toBe(2);
  expect(begun.state.activeEntryId).toBe("fragment-001");
  expect(begun.state.completedStoryEventIds).toEqual(["broken-floor.confession.enter"]);
  expect(begun.state.witnessedEntryIds).toEqual([]);
  expect(begun.state.completedRitualIds).toEqual([]);
  expect(begun.state.inventory.lantern).toBe(false);
  await page.waitForTimeout(1_800);
  expect(writes).toEqual([]);

  const { hasLocalJourney: _local, bookmarkedEntryIds: _bookmarks,
    lastSafeEntryId: _safeEntry, playerPosition: _position, ...canonical } = begun.state;
  newerJourney = { ...canonical, updatedAt: "2099-01-01T00:00:00.000Z",
    cloudSchemaVersion: 2, migratedFromNavigation: false };
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await expect.poll(() => loads).toBe(2);
  expect(await currentSave(page)).toEqual(begun);
  expect(writes).toEqual([]);
  const restoredResponse = page.waitForResponse(response => response.url().endsWith("/api/load") && response.status() === 200);
  retryGate.resolve();
  await restoredResponse;
  const continueButton = page.getByRole("button", { name: "Continue the Journey", exact: true });
  await expect(continueButton).toBeEnabled();
  await expect(opening).toHaveCount(0);
  const restored = await currentSave(page);
  // Hydration restores the existing recovery fallback to the active entry;
  // this navigation metadata is not a new witnessed or completed story event.
  expect(restored).toEqual({ ...begun, state: { ...begun.state,
    updatedAt: newerJourney.updatedAt, lastSafeEntryId: begun.state.activeEntryId } });
  expect(Object.keys(restored.state).sort()).toEqual(Object.keys(begun.state).sort());
  await page.waitForTimeout(1_800);
  expect(await currentSave(page)).toEqual(restored);
  expect(writes).toEqual([]);

  await continueButton.click();
  await expect(opening).toBeVisible();
  const wipe = opening.locator("button[data-story-event-id='broken-floor.first-wipe']");
  await expect(wipe).toBeEnabled();
  expect(await currentSave(page)).toEqual(restored);
  await wipe.click();
  await expect.poll(async () => (await currentSave(page)).state.completedStoryEventIds)
    .toEqual(["broken-floor.confession.enter", "broken-floor.first-wipe"]);
  const resumed = await currentSave(page);
  expect(resumed.version).toBe(JOURNEY_STORAGE_VERSION);
  expect(resumed.state.schemaVersion).toBe(restored.state.schemaVersion);
  expect(resumed.state.activeEntryId).toBe(restored.state.activeEntryId);
  expect(resumed.state.witnessedEntryIds).toEqual(restored.state.witnessedEntryIds);
  expect(resumed.state.completedRitualIds).toEqual(restored.state.completedRitualIds);
  expect(Object.keys(resumed.state).sort()).toEqual(Object.keys(restored.state).sort());
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0].cloudSchemaVersion).toBe(2);
  expect(writes[0].completedStoryEventIds).toEqual(resumed.state.completedStoryEventIds);
  expect(writes[0].witnessedEntryIds).toEqual(resumed.state.witnessedEntryIds);
  expect(loads).toBe(2);
});

test("a pending restore cannot hydrate an account disconnected before the response", async ({ page }) => {
  await seedSession(page);
  const responseGate = deferred();
  let requested = false, saves = 0;
  await page.route("**/api/load", async route => {
    requested = true;
    await responseGate.promise;
    return route.fulfill({ json: { ok: true, journey: remoteJourney("2099-01-01T00:00:00.000Z") } });
  });
  await page.route("**/api/save", route => { saves += 1; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  await expect.poll(() => requested).toBe(true);
  await page.evaluate(key => localStorage.removeItem(key), SESSION_KEY);
  responseGate.resolve();
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeEnabled();
  expect(await currentEntry(page)).toBe("fragment-001");
  await page.waitForTimeout(1_800);
  expect(saves).toBe(0);
});

test("an intentional newer local reset retains priority over older cloud progress", async ({ page }) => {
  const localReset = {
    ...incompleteStoryJourney(),
    storyStarted: false,
    storyStartedAt: null,
    updatedAt: "2099-01-01T00:00:00.000Z",
  };
  await page.addInitScript(({ sessionKey, token, journeyKey, journey, version }) => {
    localStorage.clear();
    localStorage.setItem(sessionKey, token);
    localStorage.setItem(journeyKey, JSON.stringify({ state: journey, version }));
  }, { sessionKey: SESSION_KEY, token: session, journeyKey: JOURNEY_STORAGE_KEY, journey: localReset, version: JOURNEY_STORAGE_VERSION });
  const writes: string[] = [];
  await page.route("**/api/load", route => route.fulfill({ json: { ok: true, journey: remoteJourney() } }));
  await page.route("**/api/save", route => {
    writes.push(route.request().postDataJSON().journey.activeEntryId);
    return route.fulfill({ json: { ok: true } });
  });
  await page.goto("/?accessible=1");
  await expect.poll(() => writes).toEqual(["fragment-001"]);
  expect(await currentEntry(page)).toBe("fragment-001");
});

test("an offline opening still restores older cloud progress after a reload", async ({ page }) => {
  // Preserve the generated opening envelope on reload, as a real browser does.
  await page.addInitScript(({ key, token }) => localStorage.setItem(key, token), { key: SESSION_KEY, token: session });
  let loads = 0, saves = 0;
  await page.route("**/api/load", route => {
    loads += 1;
    return loads === 1
      ? route.fulfill({ status: 503, json: { error: "Offline" } })
      : route.fulfill({ json: { ok: true, journey: remoteJourney() } });
  });
  await page.route("**/api/save", route => { saves += 1; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/?accessible=1");
  await expect(page.getByRole("button", { name: "Begin", exact: true })).toBeEnabled();
  expect(await currentEntry(page)).toBe("fragment-001");
  await page.reload();
  await expect.poll(() => currentEntry(page)).toBe(remoteEntry);
  await expect(page.getByRole("button", { name: "Continue the Journey", exact: true })).toBeEnabled();
  expect(loads).toBe(2);
  await page.waitForTimeout(1_800);
  expect(saves).toBe(0);
});

test("magic-link restore verifies once and only connects after its response is accepted", async ({ page }) => {
  let verifications = 0;
  const responseGate = deferred();
  await page.route("**/api/verify?*", async route => {
    verifications += 1;
    await responseGate.promise;
    return route.fulfill({ json: { ok: true, sessionToken: session, journey: remoteJourney() } });
  });
  await page.route("**/api/save", route => route.fulfill({ json: { ok: true } }));
  await page.goto("/?accessible=1&sidtw_token=test-magic-link", { waitUntil: "domcontentloaded" });
  await expect.poll(() => verifications).toBe(1);
  expect(await page.evaluate(key => localStorage.getItem(key), SESSION_KEY)).toBeNull();
  await expect(page).not.toHaveURL(/sidtw_token=/);
  responseGate.resolve();
  await expect.poll(() => currentEntry(page)).toBe(remoteEntry);
  await expect(page.getByRole("button", { name: "Continue the Journey", exact: true })).toBeEnabled();
  expect(await page.evaluate(key => localStorage.getItem(key), SESSION_KEY)).toBe(session);
  expect(verifications).toBe(1);
});
