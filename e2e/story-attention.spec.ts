import { expect, test, type Page } from "@playwright/test";
import { journeyScenes } from "../src/data/journeyBlueprint";
import { eventsForScene } from "../src/storyEvents/storyEventRegistry";
import { completeNextCinematicEvent, readCinematicStory } from "./cinematic-story-controls";

/** Reach the first substantial authored interval through production controls, never seeded state. */
async function reachAttentionEvent(page: Page) {
  const journey = page.locator("[data-accessible-journey='true']");
  for (const scene of journeyScenes) {
    await expect(journey).toHaveAttribute("data-active-entry", scene.keystoneEntryId);
    const witness = page.locator(`[data-accessible-witness="${scene.keystoneEntryId}"]`);
    if (await witness.count()) await witness.click();
    for (let action = 0; action < 40; action++) {
      const control = page.locator("button[data-story-event-id][data-story-event-optional='false']:visible:not(:disabled)").first();
      if (await control.count()) {
        const id = await control.getAttribute("data-story-event-id");
        const event = eventsForScene(scene.id).find(candidate => candidate.id === id);
        if (event?.durationMs && event.durationMs >= 1200 && event.trigger !== "sequence-complete") {
          return { event, duration: event.durationMs };
        }
      }
      if (!(await completeNextCinematicEvent(page))) break;
    }
    if (scene.id !== "epilogue.constellation") {
      await page.getByRole("button", { name: "Continue the story", exact: true }).click();
    }
  }
  throw new Error("The authored journey exposed no continuous attention event to test.");
}

test("Settings pauses attention; cancel and reload do not grant or duplicate an event", async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  // This regression measures authored attention, not the threshold animation.
  // Match the existing semantic journey setup; full-motion entry needs its own
  // visual/input qualification and must not be represented by this pass.
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  await expect(page.locator(".onboarding-gate")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const { event, duration } = await reachAttentionEvent(page);
  const control = page.locator(`button[data-story-event-id="${event.id}"]`);
  const pending = page.locator(`[data-story-event-pending="${event.id}"]`);

  await control.click();
  await expect(pending).toHaveAttribute("data-story-attention-state", "running");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.locator("#experience-settings-dialog")).toBeVisible();
  await expect(pending).toHaveAttribute("data-story-attention-state", "paused");
  await page.waitForTimeout(duration + 200);
  expect((await readCinematicStory(page)).completedStoryEventIds).not.toContain(event.id);

  await page.keyboard.press("Escape");
  await expect(page.locator("#experience-settings-dialog")).not.toBeVisible();
  await expect(pending).toHaveAttribute("data-story-attention-state", "running");
  await pending.getByRole("button").click();
  await expect(pending).toHaveCount(0);
  await page.waitForTimeout(duration + 200);
  expect((await readCinematicStory(page)).completedStoryEventIds).not.toContain(event.id);

  await control.click();
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes(event.id), {
    timeout: duration + 8000,
  }).toBe(true);
  const before = await readCinematicStory(page);
  expect(before.completedStoryEventIds.filter(id => id === event.id)).toHaveLength(1);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator(".onboarding-gate")).toHaveAttribute("aria-busy", "false");
  await page.getByRole("button", { name: "Continue the Journey", exact: true }).click();
  await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();
  const restored = await readCinematicStory(page);
  expect(restored.completedStoryEventIds.filter(id => id === event.id)).toHaveLength(1);
  expect(restored.storyObjectStates).toEqual(before.storyObjectStates);
  expect(restored.storyPlacementStates).toEqual(before.storyPlacementStates);
  await expect(pending).toHaveCount(0);
  await expect(page.locator("canvas, vite-error-overlay")).toHaveCount(0);
  expect(errors).toEqual([]);
});
