import { expect, type Page } from "@playwright/test";
import type { StoryJourneyState } from "../src/lib/storyJourneyState";

export const CINEMATIC_CHOICES = ["heart.feather.chosen", "womb.light.take", "lantern.placed.window"] as const;

export async function readCinematicStory(page: Page): Promise<StoryJourneyState> {
  return page.evaluate(() => {
    const raw = localStorage.getItem("sidtw:journey:v3");
    if (!raw) throw new Error("The UI has not persisted its journey.");
    return JSON.parse(raw).state;
  });
}

/** Uses only production semantic controls. It never writes story state. */
export async function completeNextCinematicEvent(page: Page, choices: readonly string[] = CINEMATIC_CHOICES): Promise<string | null> {
  const sequence = page.locator("[data-story-sequence='reverse-light']");
  if (await sequence.isVisible().catch(() => false)) {
    await expect(sequence).toHaveCount(0, { timeout: 35_000 });
    return "epilogue.reverse-light-complete";
  }
  const pending = page.locator("[data-story-event-pending]");
  if (await pending.count()) await expect(pending).toHaveCount(0, { timeout: 15_000 });

  const required = page.locator("button[data-story-event-id][data-story-event-optional='false']:visible:not(:disabled)");
  if (!(await required.count())) return null;
  let control = required.first();
  for (const choice of choices) {
    const preferred = page.locator(`button[data-story-event-id="${choice}"]:visible:not(:disabled)`);
    if (await preferred.count()) { control = preferred; break; }
  }
  const id = await control.getAttribute("data-story-event-id");
  if (!id) throw new Error("Story object is missing its event identity.");
  await control.click();
  await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes(id), { timeout: 15_000 }).toBe(true);
  return id;
}
