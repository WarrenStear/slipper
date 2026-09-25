import { expect, test } from "@playwright/test";
import { readCinematicStory } from "./cinematic-story-controls";

test("surface coverage rejects jitter and preserves the two-stage accessible reveal on reload", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Physical WebGL coverage uses Chromium; the semantic full route still runs on every configured project.");
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?quality=low", { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await expect(page.locator(".onboarding-gate")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const canvas = page.locator("canvas").first();
  const first = page.locator("button[data-story-event-id='broken-floor.first-wipe']");
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  await expect(first).toBeVisible({ timeout: 30_000 });
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("No rendered floor surface.");
  const x = bounds.x + bounds.width * .36;
  const y = bounds.y + bounds.height * .62;

  // More than the old 100-pixel accumulated distance, but no deliberate sweep.
  if (testInfo.project.use.isMobile) {
    const touch = await page.context().newCDPSession(page);
    const point = (i: number) => ({ x: x + i % 2 * 2, y, id: 1, radiusX: 8, radiusY: 8, force: .7 });
    try {
      await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0)] });
      for (let i = 1; i <= 60; i++) await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(i)] });
      await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    } finally { await touch.detach(); }
  } else {
    await page.mouse.move(x, y); await page.mouse.down();
    for (let i = 1; i <= 60; i++) await page.mouse.move(x + i % 2 * 2, y);
    await page.mouse.up();
  }
  expect((await readCinematicStory(page)).completedStoryEventIds).not.toContain("broken-floor.first-wipe");
  await expect(first).toBeVisible();
  await first.click();
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes("broken-floor.first-wipe"), { timeout: 30_000 }).toBe(true);
  expect((await readCinematicStory(page)).completedStoryEventIds).not.toContain("broken-floor.forest-revealed");
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "1", { timeout: 30_000 });
  const firstPath = testInfo.outputPath("first-reveal-stage.png");
  await page.screenshot({ path: firstPath, timeout: 30_000 });
  await testInfo.attach("first-reveal-stage", { path: firstPath, contentType: "image/png" });
  await page.locator("button[data-story-event-id='broken-floor.forest-revealed']").click();
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "2", { timeout: 30_000 });
  const before = await readCinematicStory(page);
  expect(before.storyObjectStates["broken-floor.reflection"]).toBe("revealed");
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await expect(page.locator(".onboarding-gate")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Continue the Journey", exact: true }).click();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "2", { timeout: 30_000 });
  await expect(page.locator("button[data-story-event-id='broken-floor.inversion']")).toBeVisible({ timeout: 30_000 });
  const restored = await readCinematicStory(page);
  expect(restored.completedStoryEventIds).toEqual(before.completedStoryEventIds);
  expect(restored.storyObjectStates["broken-floor.reflection"]).toBe("revealed");
  await expect(page.locator("vite-error-overlay")).toHaveCount(0);
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "2", { timeout: 30_000 });
  const restoredPath = testInfo.outputPath("restored-second-reveal-stage.png");
  await page.screenshot({ path: restoredPath, timeout: 30_000 });
  await testInfo.attach("restored-second-reveal-stage", { path: restoredPath, contentType: "image/png" });
  expect(errors).toEqual([]);
});
