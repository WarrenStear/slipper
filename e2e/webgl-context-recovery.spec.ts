import { expect, test } from "@playwright/test";
import { readCinematicStory } from "./cinematic-story-controls";

test("GPU context loss exposes recovery and preserves earned progress in text mode", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Real WebGL loss injection uses the Chromium WebGL projects.");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?quality=low");
  await expect(page).toHaveTitle(/Slipper in the Woods/);
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  await expect(page.locator("canvas").first()).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  // The opening's visual canvas deliberately owns pointer input. Use the
  // supported native keyboard activation rather than a pointer click through
  // its occluding layer; this still exercises the real event and durable save.
  const firstWipe = page.locator("button[data-story-event-id='broken-floor.first-wipe']");
  await expect(firstWipe).toBeVisible();
  await firstWipe.focus();
  await expect(firstWipe).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes("broken-floor.first-wipe")).toBe(true);
  const earned = (await readCinematicStory(page)).completedStoryEventIds;

  const supported = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("canvas");
    const context = canvas?.getContext("webgl2");
    const extension = context?.getExtension("WEBGL_lose_context");
    if (!extension) return false;
    extension.loseContext();
    return true;
  });
  expect(supported, "The Chromium renderer must expose real WebGL loss injection").toBe(true);
  const recovery = page.getByRole("dialog", { name: "The story is still here." });
  await expect(recovery).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(recovery.getByRole("button", { name: "Reload forest" })).toBeVisible();
  await expect(recovery.getByRole("heading")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect.poll(() => recovery.evaluate(dialog => dialog.contains(document.activeElement))).toBe(true);
  await testInfo.attach("context-loss-recovery", { body: await page.screenshot(), contentType: "image/png" });

  await recovery.getByRole("button", { name: "Continue with text journey" }).click();
  await expect(page).toHaveURL(/accessible=1/);
  const textJourney = page.locator("[data-accessible-journey='true']");
  await expect(textJourney).toBeVisible();
  expect((await readCinematicStory(page)).completedStoryEventIds).toEqual(earned);
  await expect(page.locator("canvas, vite-error-overlay")).toHaveCount(0);
  await testInfo.attach("context-loss-text-continuation", { body: await page.screenshot(), contentType: "image/png" });
  expect(errors).toEqual([]);
});
