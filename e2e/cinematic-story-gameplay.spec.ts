import { expect, test } from "@playwright/test";
import { journeyScenes } from "../src/data/journeyBlueprint";
import { completeNextCinematicEvent, readCinematicStory } from "./cinematic-story-controls";

test("the rendered floor requires two pointer wipes and a touch before inversion", async ({ page }, testInfo) => {
  test.skip(!testInfo.project.name.includes("chromium"), "This physical WebGL check runs on the configured desktop and mobile Chromium renderers; semantic equivalence runs on every project.");
  test.setTimeout(90_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const canvas = page.locator("canvas").first();
  await expect(canvas).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("button[data-story-event-id='broken-floor.first-wipe']")).toBeVisible({ timeout: 30_000 });
  expect((await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).not.toBe("inverted");
  const bounds = await canvas.boundingBox();
  if (!bounds) throw new Error("The rendered floor has no pointer surface.");
  const startX = bounds.x + bounds.width * 0.36;
  const startY = bounds.y + bounds.height * 0.62;

  for (const id of ["broken-floor.first-wipe", "broken-floor.forest-revealed"]) {
    await expect(page.locator(`button[data-story-event-id="${id}"]`)).toBeVisible();
    if (testInfo.project.use.isMobile) {
      const touch = await page.context().newCDPSession(page);
      const point = (step: number) => ({ x: startX + 12 * step, y: startY - 2.2 * step, id: 1, radiusX: 8, radiusY: 8, force: 0.7 });
      try {
        await touch.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point(0)] });
        for (let step = 1; step <= 10; step += 1) {
          await touch.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point(step)] });
          await page.waitForTimeout(20);
        }
        await touch.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
      } finally {
        await touch.detach();
      }
    } else {
      await page.mouse.move(startX, startY);
      await page.mouse.down();
      await page.mouse.move(startX + 120, startY - 22, { steps: 10 });
      await page.mouse.up();
    }
    await expect.poll(async () => (await readCinematicStory(page)).completedStoryEventIds.includes(id)).toBe(true);
    expect((await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).not.toBe("inverted");
  }
  await expect(page.locator("button[data-story-event-id='broken-floor.inversion']")).toBeVisible();
  if (testInfo.project.use.isMobile) await page.touchscreen.tap(startX, startY);
  else await page.mouse.click(startX, startY);
  await expect.poll(async () => (await readCinematicStory(page)).storyObjectStates["broken-floor.reflection"]).toBe("inverted");
  await expect(page.locator(".story-hud, .mini-map-hud, .scene-compass, .map-workspace")).toHaveCount(0);
  expect(errors).toEqual([]);
  const screenshotPath = testInfo.outputPath("pointer-revealed-forest.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach("pointer-revealed-forest", { path: screenshotPath, contentType: "image/png" });
});

test("a fresh semantic journey physically carries, changes and remembers all 32 scenes", async ({ page }, testInfo) => {
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: "reduce" });
  // Fresh Playwright context: no save seeding and no state-writing evaluate calls.
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Begin", exact: true }).click();
  const journey = page.locator("[data-accessible-journey='true']");
  const visitedScenes: string[] = [];
  const performedEvents: string[] = [];

  for (const scene of journeyScenes) {
    await test.step(scene.title, async () => {
      await expect(journey).toHaveAttribute("data-active-entry", scene.keystoneEntryId);
      visitedScenes.push(scene.id);
      const witness = page.locator(`[data-accessible-witness="${scene.keystoneEntryId}"]`);
      if (await witness.count()) await witness.click();

      if (scene.id === "nest.unsupported-cycle") {
        await page.locator("[data-carried-story-object='nest.responsibility'] button").click();
        expect((await readCinematicStory(page)).storyObjectStates["nest.responsibility"]).toBe("resting");
        await page.locator("button[data-story-event-id='nest.unsupported-cycle.recover-responsibility']").click();
        expect((await readCinematicStory(page)).storyObjectStates["nest.responsibility"]).toBe("carried");
      }

      if (scene.id === "epilogue.constellation") {
        await expect(page.locator("[data-story-sequence='reverse-light']")).toBeVisible();
        const before = await readCinematicStory(page);
        expect(before.storyCompleted).toBe(false);
        expect(before.completedStoryEventIds).not.toContain("epilogue.constellation-seen");
        await expect(page.locator("[data-gift-dedication='visible']")).toHaveCount(0);
      }

      for (let action = 0; action < 40; action += 1) {
        const id = await completeNextCinematicEvent(page);
        if (!id) break;
        performedEvents.push(id);
        if (id === "blue-moon.roses-carried") {
          await expect(page.locator("[data-carried-story-object='blue-moon.roses']")).toBeVisible();
        }
        if (id === "nest.second-hand") {
          const during = await readCinematicStory(page);
          expect(during.storyObjectStates["nest.protected-linen"]).toBe("carried");
          expect(during.storyObjectStates["nest.responsibility"]).toBe("carried");
        }
        if (id === "fire.true-memory.flame") {
          expect((await readCinematicStory(page)).storyObjectStates["fire.true-memory"]).toBe("preserved");
        }
        if (id === "heart.feather.chosen") {
          await expect(page.locator("[data-carried-story-object='heart.feather']")).toBeVisible();
        }
        if (id === "womb.light.take") {
          await page.locator("[data-carried-story-object='womb.light'] button").click();
          expect((await readCinematicStory(page)).storyObjectStates["womb.light"]).toBe("resting");
          await page.locator("button[data-story-event-id='womb.light.take']").click();
          expect((await readCinematicStory(page)).storyObjectStates["womb.light"]).toBe("carried");
          await expect(page.locator("button[data-story-event-id='womb.linen.take']")).toHaveCount(0);
          await expect(page.locator("button[data-story-event-id='womb.page.take']")).toHaveCount(0);
        }
      }

      if (scene.id !== "epilogue.constellation") {
        const next = page.getByRole("button", { name: "Continue the story", exact: true });
        await expect(next).toBeEnabled();
        await next.click();
      }
    });
  }

  await expect(journey).toHaveAttribute("data-story-complete", "true");
  expect(visitedScenes).toEqual(journeyScenes.map((scene) => scene.id));
  const state = await readCinematicStory(page);
  expect(state.completedSceneIds).toHaveLength(32);
  expect(state.storyObjectStates["fire.true-memory"]).toBe("preserved");
  expect(state.storyObjectStates["womb.creation"]).toBe("home");
  expect(state.storyPlacementStates["lantern.master"]).toBe("window");
  expect(state.completedStoryEventIds.indexOf("epilogue.reverse-light-complete")).toBeLessThan(state.completedStoryEventIds.indexOf("epilogue.constellation-seen"));
  expect(performedEvents).toEqual(expect.arrayContaining(["broken-floor.first-wipe", "broken-floor.forest-revealed", "broken-floor.inversion", "blue-moon.origami-awakened", "thorn-house.refilled", "thorn-house.pattern-returned", "river.ash-washed", "river.surrender", "fork.past-looped", "fork.let-go", "fork.declined", "fork.departed", "fork.deleted", "lantern.owned", "mind.questions-left", "heart.feather.chosen", "womb.light.created", "crown.recognised", "lantern.placed.window"]));
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator(".accessible-story-journey__progress")).toHaveCount(0);
  await expect(page.locator("[data-accessible-constellation-formation='complete']")).toBeVisible();
  await expect(page.locator("[data-gift-dedication='visible']")).toBeVisible();
  expect(errors).toEqual([]);
  const screenshotPath = testInfo.outputPath("completed-semantic-journey.png");
  await page.screenshot({ path: screenshotPath, fullPage: false });
  await testInfo.attach("completed-semantic-journey", { path: screenshotPath, contentType: "image/png" });

  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByRole("button", { name: "Return to the Woods", exact: true })).toBeVisible();
  const restored = await readCinematicStory(page);
  expect(restored.storyPlacementStates).toEqual(state.storyPlacementStates);
  expect(restored.storyObjectStates).toEqual(state.storyObjectStates);
  expect(restored.completedStoryEventIds).toEqual(state.completedStoryEventIds);
});
