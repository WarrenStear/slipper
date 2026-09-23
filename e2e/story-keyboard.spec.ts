import { expect, test } from "@playwright/test";
import { readCinematicStory } from "./cinematic-story-controls";

test("modified and composing keys cannot perform a focused story action", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Physical story input is checked with desktop Chromium.");
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?quality=low", { waitUntil: "domcontentloaded" });
  await page.bringToFront();
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "0", { timeout: 30_000 });
  await expect(page.locator("button[data-story-event-id='broken-floor.first-wipe']")).toBeVisible();
  const before = await readCinematicStory(page);

  for (const modifier of ["ctrlKey", "metaKey", "altKey", "isComposing", "defaultPrevented"]) {
    // Deliver the page-visible keyboard event without invoking a host-browser
    // shortcut. The production handler must reject it before changing the save.
    await page.evaluate(modifier => {
      const event = new KeyboardEvent("keydown", { key: "e", code: "KeyE", bubbles: true, cancelable: true, [modifier]: true });
      if (modifier === "defaultPrevented") event.preventDefault();
      window.dispatchEvent(event);
      window.dispatchEvent(new KeyboardEvent("keyup", { key: "e", code: "KeyE", bubbles: true }));
    }, modifier);
    await page.waitForTimeout(200);
    expect((await readCinematicStory(page)).completedStoryEventIds, modifier).toEqual(before.completedStoryEventIds);
    await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "0");
  }

  await page.evaluate(() => {
    const editor = document.createElement("div");
    editor.contentEditable = "true";
    document.body.append(editor);
    editor.focus();
    editor.dispatchEvent(new KeyboardEvent("keydown", { key: "e", code: "KeyE", bubbles: true }));
    editor.dispatchEvent(new KeyboardEvent("keyup", { key: "e", code: "KeyE", bubbles: true }));
    editor.remove();
  });
  expect((await readCinematicStory(page)).completedStoryEventIds).toEqual(before.completedStoryEventIds);
  const unchangedPath = testInfo.outputPath("keyboard-shortcuts-preserve-opening.png");
  await page.screenshot({ path: unchangedPath });
  await testInfo.attach("modified-keys-preserve-opening", { path: unchangedPath, contentType: "image/png" });

  // A positive control prevents a disabled keyboard path from passing the test.
  await page.keyboard.press("e");
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes("broken-floor.first-wipe")).toBe(true);
  await expect(canvas).toHaveAttribute("data-opening-rendered-stage", "1");
  const earnedPath = testInfo.outputPath("ordinary-key-earns-first-wipe.png");
  await page.screenshot({ path: earnedPath });
  await testInfo.attach("ordinary-key-earns-first-wipe", { path: earnedPath, contentType: "image/png" });
});
