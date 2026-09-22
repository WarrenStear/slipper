import { expect, test } from "@playwright/test";
import { completedStoryJourney, seedStoryJourney } from "./story-first-fixtures";

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
