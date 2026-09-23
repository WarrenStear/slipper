import { expect, test } from "@playwright/test";
import { completeNextCinematicEvent, readCinematicStory } from "./cinematic-story-controls";

test("advances the canonical story without WebGL while prose stays veiled", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (request) => {
    if (request.resourceType() === "image") imageRequests.push(request.url());
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });

  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const journey = page.locator("[data-accessible-journey='true']");
  await expect(journey).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(journey).toHaveAttribute("data-active-entry", "fragment-001");
  await expect(page.getByText("What a deluded illusion I keep turning to.", { exact: false })).toHaveCount(0);

  await page.locator("[data-accessible-witness='fragment-001']").click();
  await expect(page.getByText("What a deluded illusion I keep turning to.", { exact: false })).toBeVisible();

  expect(await completeNextCinematicEvent(page)).toBe("broken-floor.first-wipe");
  expect(await completeNextCinematicEvent(page)).toBe("broken-floor.forest-revealed");
  expect(await completeNextCinematicEvent(page)).toBe("broken-floor.inversion");
  expect((await readCinematicStory(page)).completedRitualIds).toContain("ritual.accept-lantern");

  const continueButton = page.getByRole("button", { name: "Continue the story" });
  await expect(continueButton).toBeEnabled();
  await continueButton.click();
  await expect(journey).toHaveAttribute("data-active-entry", "fragment-008");
  await expect(page.getByText("Guilty of feeding the fantasy", { exact: false })).toHaveCount(0);

  await page.locator("[data-accessible-witness='fragment-008']").click();
  await expect(page.getByText("Guilty of feeding the fantasy", { exact: false })).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  // The text journey has no linked-photo surface, even after advancing scenes.
  // Do not spend a reader's bandwidth preloading legacy 3D image panels.
  expect(imageRequests.filter((url) => new URL(url).pathname.startsWith("/visuals/"))).toEqual([]);
});

test("completes every canonical text scene and records the Heart and Womb choices", async ({ page }) => {
  test.setTimeout(180_000);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.addInitScript(() => {
    Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
      configurable: true,
      value: () => null,
    });
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Begin", exact: true }).click();

  const journey = page.locator("[data-accessible-journey='true']");
  let choseHeartMemory = false;
  let choseFuture = false;

  for (let step = 0; step < 180; step += 1) {
    if ((await journey.getAttribute("data-story-complete")) === "true") break;

    const witness = page.locator("[data-accessible-witness]:visible");
    if (await witness.count()) {
      await witness.first().click();
      continue;
    }

    const eventId = await completeNextCinematicEvent(page);
    if (eventId) {
      if (eventId === "heart.feather.chosen") choseHeartMemory = true;
      if (eventId === "womb.light.created") choseFuture = true;
      continue;
    }

    const ritual = page.locator("[data-accessible-ritual-id]:visible");
    if (await ritual.count()) {
      await ritual.first().getByRole("button").click();
      continue;
    }

    const action = page.locator("[data-accessible-action-id]:visible");
    if (await action.count()) {
      const actionId = await action.first().getAttribute("data-accessible-action-id");
      if (actionId === "action.climb.heart.choose-memory") {
        await action.locator("[data-accessible-choice-id='heart.selfhood']").click();
        choseHeartMemory = true;
      } else if (actionId === "action.climb.womb.choose-creation") {
        await action.locator("[data-accessible-choice-id='future.home']").click();
        choseFuture = true;
      } else {
        await action.first().getByRole("button").first().click();
      }
      continue;
    }

    const continueButton = page.getByRole("button", { name: "Continue the story" });
    if (await continueButton.isEnabled()) {
      await continueButton.click();
      continue;
    }

    await page.waitForTimeout(35);
  }

  await expect(journey).toHaveAttribute("data-story-complete", "true");
  // The dedication correctly removes its background from the accessibility
  // tree after constellation formation; verify both parts of that ending.
  await expect(page.locator(".accessible-story-coda h2")).toHaveText("I returned to myself.");
  await expect(page.locator("[data-gift-dedication='visible']")).toBeVisible();
  await expect(page.locator(".accessible-story-journey__progress")).toHaveCount(0);
  expect(choseHeartMemory).toBe(true);
  expect(choseFuture).toBe(true);
  await expect(page.locator("canvas")).toHaveCount(0);
});
