import { expect, test, type Page } from "@playwright/test";
import { readCinematicStory } from "./cinematic-story-controls";

const openingQuality = process.env.PLAYWRIGHT_OPENING_QUALITY ?? "low";
// A requested tier must exercise its passes: reduced-motion defaults also
// enable reduced effects in the application and would silently test a fallback.
const fullEffects = Boolean(process.env.PLAYWRIGHT_OPENING_QUALITY);

async function begin(page: Page, resume = false) {
  await page.bringToFront();
  await expect(page.locator(".onboarding-gate")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: resume ? "Continue the Journey" : "Begin", exact: true }).click();
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-effects", fullEffects ? "full" : "reduced");
  await expect.poll(() => page.evaluate(() => localStorage.getItem("sidtw-render-quality"))).toBe(openingQuality);
  // Canvas fallback children mount even with working WebGL; an invisible modal
  // there would make the rendered forest inert and swallow physical gestures.
  await expect(page.locator("canvas dialog")).toHaveCount(0);
  await expect(page.locator("dialog:modal")).toHaveCount(0);
}

async function stroke(page: Page, mobile: boolean) {
  const box = await page.locator("canvas").first().boundingBox();
  if (!box) throw new Error("Opening canvas has no rendered bounds.");
  const x = box.x + box.width * .36, y = box.y + box.height * .62;
  if (!mobile) {
    await page.mouse.move(x, y); await page.mouse.down();
    await page.mouse.move(x + 120, y - 22, { steps: 10 }); await page.mouse.up();
    return;
  }
  const input = await page.context().newCDPSession(page);
  const point = (i: number) => ({ x: x + i * 12, y: y - i * 2.2, id: 1, radiusX: 8, radiusY: 8, force: .7 });
  try {
    await input.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0)] });
    for (let i = 1; i <= 10; i++) {
      await input.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(i)] });
      await page.waitForTimeout(20);
    }
    await input.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally { await input.detach(); }
}

// The production desktop controller intentionally disables native pointer lock
// under webdriver. Observe a downstream click listener without changing that
// guard or writing story state; native browser permissions remain a separate QA.
async function observeClickHandoff(page: Page) {
  await page.locator("canvas").first().evaluate(canvas => {
    canvas.dataset.openingBubbleClicks = "0";
    canvas.addEventListener("click", () => {
      canvas.dataset.openingBubbleClicks = String(Number(canvas.dataset.openingBubbleClicks) + 1);
    });
  });
}

test("opening sequence keeps floor input, restores the earned reveal, then hands back clicking", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Physical WebGL and CDP input run on the configured Chromium projects.");
  test.setTimeout(120_000);
  const errors: string[] = [];
  const linkedPhotoRequests: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("request", request => {
    if (new URL(request.url()).pathname.startsWith("/visuals/")) linkedPhotoRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: fullEffects ? "no-preference" : "reduce" });
  await page.goto(`/?quality=${openingQuality}`, { waitUntil: "domcontentloaded" });
  await begin(page);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  await observeClickHandoff(page);
  const mobile = Boolean(testInfo.project.use.isMobile);

  for (const [index, id] of ["broken-floor.first-wipe", "broken-floor.forest-revealed"].entries()) {
    await expect(page.locator(`button[data-story-event-id="${id}"]`)).toBeVisible();
    await stroke(page, mobile);
    await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes(id)).toBe(true);
    await expect(canvas).toHaveAttribute("data-opening-rendered-stage", String(index + 1));
    expect((await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).not.toBe("inverted");
    await expect(canvas).toHaveAttribute("data-opening-bubble-clicks", "0");
  }
  const before = await readCinematicStory(page);
  await page.reload({ waitUntil: "domcontentloaded" });
  await begin(page, true);
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "2", { timeout: 30_000 });
  const restored = await readCinematicStory(page);
  expect(restored.completedStoryEventIds).toEqual(before.completedStoryEventIds);
  expect(restored.storyObjectStates["broken-floor.reflection"]).toBe("revealed");

  await expect(page.locator("button[data-story-event-id='broken-floor.inversion']")).toBeVisible();
  await observeClickHandoff(page);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Restored opening canvas has no rendered bounds.");
  const x = box.x + box.width * .36, y = box.y + box.height * .62;
  if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await expect.poll(async () => (await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).toBe("inverted");
  await expect(canvas).toHaveAttribute("data-opening-bubble-clicks", "0");
  if (mobile) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
  await expect(canvas).toHaveAttribute("data-opening-bubble-clicks", "1");
  const final = await readCinematicStory(page);
  expect(final.completedStoryEventIds.filter(id => id === "broken-floor.inversion")).toHaveLength(1);
  expect(final.completedRitualIds).toContain("ritual.accept-lantern");
  expect(errors).toEqual([]);
  // The authored opening uses its own surfaces, including after restoration.
  expect(linkedPhotoRequests).toEqual([]);
  await testInfo.attach("earned-opening-state", { body: JSON.stringify({
    before: before.completedStoryEventIds, restored: restored.completedStoryEventIds,
    completed: final.completedStoryEventIds, scene: final.sceneId,
  }, null, 2), contentType: "application/json" });
});

// Evidence is its own bounded test: screenshot failures stay visible here and
// cannot conceal which functional assertion passed/failed in the test above.
test("opening sequence captures rendered stages without sharing the functional test timeout", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "Physical rendering capture uses Chromium.");
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: fullEffects ? "no-preference" : "reduce" });
  await page.goto(`/?quality=${openingQuality}`, { waitUntil: "domcontentloaded" });
  await begin(page);
  const canvas = page.locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  const mobile = Boolean(testInfo.project.use.isMobile);
  // Capture the same real input route as the functional test. The separate
  // legacy scene-polish case continues to qualify the DOM action alternative.
  for (const [index, id] of ["broken-floor.first-wipe", "broken-floor.forest-revealed"].entries()) {
    await expect(page.locator(`button[data-story-event-id="${id}"]`)).toBeVisible({ timeout: 30_000 });
    await stroke(page, mobile);
    await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes(id)).toBe(true);
    await expect(canvas).toHaveAttribute("data-opening-rendered-stage", String(index + 1));
    const path = testInfo.outputPath(`rendered-stage-${index + 1}.png`);
    await page.screenshot({ path, timeout: 30_000 });
    await testInfo.attach(`rendered-stage-${index + 1}`, { path, contentType: "image/png" });
  }
  expect((await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).toBe("revealed");
  expect(errors).toEqual([]);
});
