import { expect, test } from "@playwright/test";
import { completedStoryJourney, seedStoryJourney } from "./story-first-fixtures";
import { readCinematicStory } from "./cinematic-story-controls";
import { selectMemoryView } from "./quiet-memory-controls";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

test("WebGL1-only devices enter the text journey", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: (kind: string) => kind === "webgl" ? {} : null,
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.locator("[data-accessible-witness='fragment-001']").click();
  await expect(page.getByText("What a deluded illusion I keep turning to.", { exact: false })).toBeVisible();
});

test("settings offers the text journey before entering the forest", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?quality=low");
  await expect(page).toHaveTitle(/Slipper in the Woods/);
  await page.getByRole("button", { name: "Accessibility and sound settings" }).click();
  await page.getByRole("button", { name: "Continue with text journey" }).click();
  await expect(page).toHaveURL(/accessible=1/);
  await expect(page.getByRole("dialog", { name: "Experience settings" })).not.toBeVisible();
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();
  await expect(page.locator("canvas, vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("storage quota failure keeps the story and settings interactive", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => { throw new DOMException("Full", "QuotaExceededError"); };
  });
  await page.goto("/?accessible=1");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await page.locator("[data-accessible-witness='fragment-001']").click();
  await expect(page.getByText("What a deluded illusion I keep turning to.", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).last().click();
  await page.getByRole("button", { name: "High contrast" }).click();
  await expect(page.getByRole("button", { name: "High contrast" })).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});

test("settings stays reachable during the 3D opening and preserves progress in text mode", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "The physical opening uses the Chromium WebGL projects.");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/?quality=low");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.locator("canvas").first()).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  await expect(page.locator("[data-experience-root]")).toHaveAttribute("data-story-actions", "available", { timeout: 30_000 });
  // The opening control is deliberately veiled; activate its actual semantic action with keyboard focus.
  const wipe = page.locator("button[data-story-event-id='broken-floor.first-wipe']");
  await wipe.focus();
  await expect(wipe).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes("broken-floor.first-wipe")).toBe(true);
  const earned = (await readCinematicStory(page)).completedStoryEventIds;
  await selectMemoryView(page, "Settings");
  await expect(page.getByRole("dialog", { name: "Experience settings" })).toBeVisible();
  await page.getByRole("button", { name: "Continue with text journey" }).click();
  await expect(page).toHaveURL(/accessible=1/);
  await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();
  expect((await readCinematicStory(page)).completedStoryEventIds).toEqual(earned);
  await expect(page.locator("canvas, vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("modified browser shortcuts do not open settings", async ({ page }) => {
  await page.goto("/?accessible=1");
  await page.evaluate(() => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "o", ctrlKey: true, bubbles: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: ",", metaKey: true, bubbles: true }));
  });
  await expect(page.getByRole("dialog", { name: "Experience settings" })).not.toBeVisible();
  await page.keyboard.press("o");
  await expect(page.getByRole("dialog", { name: "Experience settings" })).toBeVisible();
});

test("a failed scene chunk offers recovery and retains the current journey", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Renderer failure injection uses the Chromium WebGL projects.");
  await page.goto("/?quality=low");
  await seedStoryJourney(page, completedStoryJourney(), { dedicationAcknowledged: true });
  await page.route(/\/assets\/WorldCanvas-[^/]+\.js$/, route => route.abort());
  await page.reload();
  await page.locator(".onboarding-actions button.primary").click();
  await expect(page.getByRole("heading", { name: "The story is still here." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload forest" })).toBeVisible();
  const recovery = page.getByRole("dialog", { name: "The story is still here." });
  await expect(recovery).toBeVisible();
  await page.getByRole("button", { name: "Continue with text journey" }).focus();
  for (let step = 0; step < 5; step += 1) {
    await page.keyboard.press("Tab");
    await expect.poll(() => recovery.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("o");
  await expect(page.getByRole("dialog", { name: "Experience settings" })).not.toBeVisible();
  await page.getByRole("button", { name: "Continue with text journey" }).click();
  const journey = page.locator("[data-accessible-journey='true']");
  await expect(journey).toHaveAttribute("data-active-entry", completedStoryJourney().activeEntryId);
  await expect(journey).toHaveAttribute("data-story-complete", "true");
  await expect(journey.locator("h1")).toBeFocused();
  await expect(page.locator("canvas")).toHaveCount(0);
});

test("worker failure surfaces recovery instead of an empty forest", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Worker failure injection uses the Chromium WebGL projects.");
  await page.goto("/?quality=low");
  const snapshot = { ...completedStoryJourney(), activeEntryId: "fragment-008" };
  await seedStoryJourney(page, snapshot, { dedicationAcknowledged: true });
  await page.route(/\/assets\/forestWorker-[^/]+\.js$/, route => route.abort());
  await page.reload();
  await page.locator(".onboarding-actions button.primary").click();
  await expect(page.getByRole("heading", { name: "The story is still here." })).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Continue with text journey" }).click();
  await expect(page.locator("[data-accessible-journey='true']")).toHaveAttribute("data-active-entry", "fragment-008");
});

test("a worker startup exception preserves recovery and the current journey", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Worker failure injection uses the Chromium WebGL projects.");
  // Measure recovery after the failure is actually injected. Scene/GPU startup
  // has its own bounded precondition; the original abort case above still keeps
  // its end-to-end deadline, including startup.
  test.setTimeout(120_000);
  await page.goto("/?quality=low");
  const snapshot = { ...completedStoryJourney(), activeEntryId: "fragment-008" };
  await seedStoryJourney(page, snapshot, { dedicationAcknowledged: true });
  await page.route(/\/assets\/forestWorker-[^/]+\.js$/, route => route.fulfill({
    contentType: "application/javascript",
    body: 'throw new Error("Injected forest worker startup failure");',
  }));
  await page.reload();
  const workerRequested = page.waitForRequest(/\/assets\/forestWorker-[^/]+\.js$/, { timeout: 60_000 });
  const beginAt = Date.now();
  await page.locator(".onboarding-actions button.primary").click();
  const request = await workerRequested;
  const injectedAt = Date.now();
  await expect.poll(async () => (await request.response())?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "The story is still here." })).toBeVisible({ timeout: 30_000 });
  const recoveredAt = Date.now();
  await page.getByRole("button", { name: "Continue with text journey" }).click();
  await expect(page.locator("[data-accessible-journey='true']")).toHaveAttribute("data-active-entry", "fragment-008");
  await expect(page.locator("[data-accessible-journey='true']")).toHaveAttribute("data-story-complete", "true");
  await expect(page.locator("canvas")).toHaveCount(0);
  await testInfo.attach("worker-startup-and-recovery-timing", { body: JSON.stringify({
    beginToInjectedRequestMs: injectedAt - beginAt,
    injectedRequestToRecoveryMs: recoveredAt - injectedAt,
  }, null, 2), contentType: "application/json" });
});
