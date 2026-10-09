import {
  expect,
  test,
  type Locator,
  type Page,
  type TestInfo,
} from "@playwright/test";
import {
  completedStoryJourney,
  seedStoryJourney,
} from "./story-first-fixtures";
import { journeyScenes } from "../src/data/journeyBlueprint";

type SceneTelemetry = {
  x: number;
  y: number;
  z: number;
  yaw: number;
};

const WEBGL_TIMEOUT_MS = 45_000;
const expectWebGL = expect.configure({ timeout: WEBGL_TIMEOUT_MS });

function isMobileProject(testInfo: TestInfo) {
  return testInfo.project.name.startsWith("mobile-");
}

async function clearStorageOnce(page: Page) {
  await page.addInitScript(() => {
    const storageGuard = "sidtw:e2e-storage-ready";
    if (sessionStorage.getItem(storageGuard) === "true") return;

    localStorage.clear();
    sessionStorage.clear();
    sessionStorage.setItem(storageGuard, "true");
  });
  await page.goto("/?welcome=1", { waitUntil: "domcontentloaded" });
}

async function enterForest(page: Page) {
  await page
    .getByRole("button", { name: "Return to the Woods", exact: true })
    .click();
  const root = page.locator("[data-experience-root]");
  await expectWebGL(root).toHaveAttribute("data-world-mode", "explore");
  await expectWebGL(
    page.getByRole("region", { name: "Mobile forest controls" }),
  ).toBeVisible();
  return root;
}

async function openMemories(page: Page, paths = false) {
  await page.getByRole("button", { name: "Memories", exact: true }).click();
  const menu = page.getByRole("dialog", { name: "Memories", exact: true });
  await expect(menu).toBeVisible();
  if (paths) {
    const summary = menu.getByText("Walking and remembered paths", { exact: true });
    if (!await summary.evaluate((element) => element.parentElement?.hasAttribute("open"))) {
      await summary.click();
    }
  }
  return menu;
}

async function openConstellation(page: Page) {
  const menu = await openMemories(page);
  await menu.getByRole("button", { name: "Constellation", exact: true }).click();
  await expect(menu).not.toBeVisible();
}

async function dispatchSyntheticTouchDrag(
  target: Locator,
  pointerId: number,
  delta: { x: number; y: number },
) {
  const bounds = await target.boundingBox();
  expect(bounds).not.toBeNull();
  if (!bounds) throw new Error("Touch control has no layout box.");

  const start = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const base = {
    pointerId,
    pointerType: "touch",
    isPrimary: true,
    bubbles: true,
    cancelable: true,
    pressure: 0.6,
  };

  await target.dispatchEvent("pointerdown", {
    ...base,
    buttons: 1,
    clientX: start.x,
    clientY: start.y,
  });
  await target.dispatchEvent("pointermove", {
    ...base,
    buttons: 1,
    clientX: start.x + delta.x,
    clientY: start.y + delta.y,
  });

  return { start, bounds };
}

async function readJoystickThumbOffset(page: Page) {
  return page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(
      ".mobile-joystick-thumb",
    );
    if (!element) throw new Error("Joystick thumb is missing.");
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === "none") return 0;
    const matrix = new DOMMatrixReadOnly(transform);
    return Math.hypot(matrix.m41, matrix.m42);
  });
}

async function cancelTouchAndReadThumbOffset(
  joystick: Locator,
  pointerId: number,
) {
  return joystick.evaluate((element, activePointerId) => {
    element.dispatchEvent(
      new PointerEvent("pointercancel", {
        pointerId: activePointerId,
        pointerType: "touch",
        isPrimary: true,
        bubbles: true,
        cancelable: true,
      }),
    );

    const thumb = element.querySelector<HTMLElement>(".mobile-joystick-thumb");
    if (!thumb) throw new Error("Joystick thumb is missing.");
    const transform = getComputedStyle(thumb).transform;
    if (!transform || transform === "none") return 0;
    const matrix = new DOMMatrixReadOnly(transform);
    return Math.hypot(matrix.m41, matrix.m42);
  }, pointerId);
}

async function beginTrustedChromiumTouchDrag(
  page: Page,
  target: Locator,
  delta: { x: number; y: number },
) {
  const bounds = await target.boundingBox();
  if (!bounds) throw new Error("Touch control has no layout box.");

  const session = await page.context().newCDPSession(page);
  const start = {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2,
  };
  const end = {
    x: start.x + delta.x,
    y: start.y + delta.y,
  };
  const touchPoint = (x: number, y: number) => ({
    x,
    y,
    id: 1,
    radiusX: 8,
    radiusY: 8,
    force: 0.7,
  });

  await session.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [touchPoint(start.x, start.y)],
  });
  for (let step = 1; step <= 5; step += 1) {
    const progress = step / 5;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        touchPoint(
          start.x + (end.x - start.x) * progress,
          start.y + (end.y - start.y) * progress,
        ),
      ],
    });
    await page.waitForTimeout(20);
  }

  return async () => {
    try {
      await session.send("Input.dispatchTouchEvent", {
        type: "touchEnd",
        touchPoints: [],
      });
    } finally {
      await session.detach();
    }
  };
}

async function readTelemetry(root: Locator): Promise<SceneTelemetry | null> {
  const values = await root.evaluate((element) => {
    const attributes = [
      "data-player-x",
      "data-player-y",
      "data-player-z",
      "data-camera-yaw",
    ];
    return attributes.map((attribute) => element.getAttribute(attribute));
  });
  if (
    values.some(
      (value) => value === null || value === undefined || value.trim() === "",
    )
  ) {
    return null;
  }

  const [x, y, z, yaw] = values.map((value) => Number(value));
  if (![x, y, z, yaw].every(Number.isFinite)) return null;
  return { x, y, z, yaw };
}

async function waitForTelemetry(
  root: Locator,
  timeoutMs = 15_000,
): Promise<SceneTelemetry | null> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const telemetry = await readTelemetry(root);
    if (telemetry) return telemetry;
    await root.page().waitForTimeout(250);
  }
  return null;
}

function displacement(a: SceneTelemetry, b: SceneTelemetry) {
  return Math.hypot(b.x - a.x, b.z - a.z);
}

function yawDelta(a: number, b: number) {
  return Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a)));
}

test.describe("mobile navigation surfaces", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      !isMobileProject(testInfo),
      "Mobile-only coverage runs in both configured touch-device projects.",
    );
    await clearStorageOnce(page);
    await seedStoryJourney(page, completedStoryJourney(), {
      dedicationAcknowledged: true,
    });
    await page.reload({ waitUntil: "domcontentloaded" });
  });

  test("shows safe controls and applies persisted handedness", async ({
    page,
  }) => {
    test.slow(
      true,
      "This test mounts and reloads the full WebGL world on a software renderer.",
    );
    page.setDefaultTimeout(WEBGL_TIMEOUT_MS);

    await expect(page.locator("html")).toHaveAttribute("data-mobile", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-orientation",
      "portrait",
    );
    await page
      .getByRole("button", { name: "Accessibility and sound settings" })
      .click();
    const settings = page.getByRole("dialog", {
      name: "Experience settings",
    });
    await expect(
      settings.getByRole("button", { name: /Desktop movement mode/ }),
    ).toHaveCount(0);
    await settings
      .getByLabel("Movement control side")
      .selectOption("right");
    await settings
      .getByRole("button", { name: "Close settings" })
      .click();

    await enterForest(page);
    let controls = page.getByRole("region", {
      name: "Mobile forest controls",
    });
    await expectWebGL(controls).toHaveClass(/controls-right/);
    await expectWebGL(controls).toHaveClass(/is-direct/);
    const memories = page.getByRole("button", { name: "Memories", exact: true });
    const memoriesBox = await memories.boundingBox();
    expect(memoriesBox, "mobile Memories target should have a layout box").not.toBeNull();
    expect(memoriesBox!.width).toBeGreaterThanOrEqual(44);
    expect(memoriesBox!.height).toBeGreaterThanOrEqual(44);

    let menu = await openMemories(page, true);
    const direct = menu.getByRole("radio", { name: "Direct mobile controls", exact: true });
    const guided = menu.getByRole("radio", { name: "Guided mobile controls", exact: true });
    await expect(direct).toBeChecked();
    for (const target of [
      menu.getByRole("button", { name: "Fragment", exact: true }),
      menu.getByRole("button", { name: "Constellation", exact: true }),
    ]) {
      const box = await target.boundingBox();
      expect(box, "mobile memory target should have a layout box").not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    await guided.check();
    await expect(guided).toBeChecked();
    await menu.getByRole("button", { name: "Close memories", exact: true }).click();
    await expectWebGL(controls).toHaveClass(/is-guided/);
    for (const target of [
      controls.getByRole("group", { name: "Analogue movement control" }),
      controls.getByRole("group", { name: "Drag to look around" }),
    ]) {
      const box = await target.boundingBox();
      expect(box, "mobile movement target should have a layout box").not.toBeNull();
      expect(box!.width).toBeGreaterThanOrEqual(44);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }

    await page.reload({ waitUntil: "domcontentloaded" });
    await enterForest(page);
    controls = page.getByRole("region", {
      name: "Mobile forest controls",
    });
    await expectWebGL(controls).toHaveClass(/controls-right/);
    await expectWebGL(controls).toHaveClass(/is-guided/);
    menu = await openMemories(page, true);
    await expect(menu.getByRole("radio", { name: "Guided mobile controls", exact: true })).toBeChecked();
    await menu.getByRole("radio", { name: "Direct mobile controls", exact: true }).check();
    await menu.getByRole("button", { name: "Settings", exact: true }).click();
    await settings.getByLabel("Movement control side").selectOption("left");
    await settings
      .getByRole("button", { name: "Close settings" })
      .click();
    await expectWebGL(controls).toHaveClass(/controls-left/);
  });

  test("keeps map tabs operable across portrait and landscape", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-webkit",
      "The spatial Free Woods map requires a stable WebGL context; mobile Chromium covers its touch and orientation contract.",
    );
    test.slow(
      true,
      "WebKit can take longer to settle after viewport orientation changes.",
    );
    page.setDefaultTimeout(WEBGL_TIMEOUT_MS);

    const root = await enterForest(page);
    await openConstellation(page);
    await expect(root).toHaveAttribute("data-world-mode", "map");

    const constellation = page.getByRole("tab", {
      name: "Constellation",
    });
    const archive = page.getByRole("tab", { name: "Archive list" });
    await expect(constellation).toHaveAttribute("aria-selected", "true");
    await expect(archive).toHaveAttribute("aria-selected", "false");

    const constellationPanelId =
      await constellation.getAttribute("aria-controls");
    const archivePanelId = await archive.getAttribute("aria-controls");
    expect(constellationPanelId).toBeTruthy();
    expect(archivePanelId).toBeTruthy();
    await expect(page.locator(`#${constellationPanelId}`)).toBeVisible();
    await expect(page.locator(`#${archivePanelId}`)).toBeHidden();

    await constellation.focus();
    await page.keyboard.press("ArrowRight");
    await expect(archive).toBeFocused();
    await expect(archive).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(`#${constellationPanelId}`)).toBeHidden();
    await expect(page.locator(`#${archivePanelId}`)).toBeVisible();

    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.locator("html")).toHaveAttribute(
      "data-orientation",
      "landscape",
    );
    await expect(archive).toHaveAttribute("aria-selected", "true");

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.locator("html")).toHaveAttribute(
      "data-orientation",
      "portrait",
    );
    await expect(archive).toHaveAttribute("aria-selected", "true");

    await archive.focus();
    await page.keyboard.press("Home");
    await expect(constellation).toBeFocused();
    await expect(constellation).toHaveAttribute("aria-selected", "true");
  });

  test("guidance preserves the active entry and recovery clears the route", async ({
    page,
  }, testInfo) => {
    test.skip(
      testInfo.project.name === "mobile-webkit",
      "The spatial Free Woods map requires a stable WebGL context; mobile Chromium covers guided recovery.",
    );
    const completedWithUnreadMemories = completedStoryJourney();
    const witnessedKeystones = journeyScenes.map((scene) => scene.keystoneEntryId);
    completedWithUnreadMemories.history = witnessedKeystones.filter(
      (entryId) => entryId !== completedWithUnreadMemories.activeEntryId,
    );
    completedWithUnreadMemories.visitedEntryIds = witnessedKeystones;
    completedWithUnreadMemories.witnessedEntryIds = witnessedKeystones;
    await seedStoryJourney(page, completedWithUnreadMemories, {
      dedicationAcknowledged: true,
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    const root = await enterForest(page);
    await openConstellation(page);
    const activeBefore = await root.getAttribute("data-active-entry");
    expect(activeBefore).toBeTruthy();

    const keyboardLandmarks = page.locator(
      ".constellation-spatial-svg .constellation-node-button[data-keyboard-landmark='true'][role='button']",
    );
    await expect(keyboardLandmarks).not.toHaveCount(0);
    await expect
      .poll(() => keyboardLandmarks.count())
      .toBeLessThanOrEqual(2);
    await expect(
      page.locator(
        ".constellation-spatial-svg .constellation-node-button:not([data-keyboard-landmark='true'])[aria-hidden='true'][tabindex='-1']",
      ),
    ).not.toHaveCount(0);

    const unreadTarget = page
      .locator(".constellation-spatial-svg")
      .getByRole("button", {
        name: /Guide through the forest to an unread memory/,
      })
      .first();
    await expect(unreadTarget).toBeVisible();
    await expect(unreadTarget).toHaveAccessibleName(
      /Guide through the forest to an unread memory/,
    );
    await unreadTarget.focus();
    await page.keyboard.press("Enter");

    await expect(root).toHaveAttribute("data-world-mode", "explore");
    await expect(root).toHaveAttribute("data-active-entry", activeBefore!);
    await expect
      .poll(
        async () =>
          (await root.getAttribute("data-guidance-target")) ?? "",
      )
      .not.toBe("");

    const controls = page.getByRole("region", {
      name: "Mobile forest controls",
    });
    const guidanceBefore = await root.getAttribute("data-guidance-target");
    const menu = await openMemories(page, true);
    const guided = menu.getByRole("radio", { name: "Guided mobile controls", exact: true });
    await guided.check();
    await expect(guided).toBeChecked();
    await expect(controls).toHaveClass(/is-guided/);
    await menu.getByRole("button", { name: /Follow lantern|Refresh route/ }).click();
    await expect(menu).not.toBeVisible();
    await expect(root).toHaveAttribute("data-active-entry", activeBefore!);
    await expect(root).toHaveAttribute("data-guidance-target", guidanceBefore!);

    const recoveryMenu = await openMemories(page, true);
    await recoveryMenu.getByRole("button", { name: "Last clearing", exact: true }).click();
    await expect(root).toHaveAttribute("data-world-mode", "explore");
    await expect(root).toHaveAttribute("data-active-entry", activeBefore!);
    await expect(root).toHaveAttribute("data-guidance-target", "");
    await expect(root.locator("p[role='status']")).toContainText(
      "Returned safely",
    );
  });

  test("resets direct input on blur, resize, and pointer cancellation", async ({
    page,
  }) => {
    test.slow(
      true,
      "This test mounts the full WebGL world on a software renderer.",
    );
    page.setDefaultTimeout(WEBGL_TIMEOUT_MS);

    await enterForest(page);
    const controls = page.getByRole("region", {
      name: "Mobile forest controls",
    });
    const joystick = controls.getByRole("group", {
      name: "Analogue movement control",
    });

    await dispatchSyntheticTouchDrag(joystick, 21, { x: 28, y: -32 });
    expect(await readJoystickThumbOffset(page)).toBeGreaterThan(1);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    expect(await readJoystickThumbOffset(page)).toBeLessThan(0.01);

    await dispatchSyntheticTouchDrag(joystick, 22, { x: -26, y: -30 });
    expect(await readJoystickThumbOffset(page)).toBeGreaterThan(1);
    await page.setViewportSize({ width: 844, height: 390 });
    expect(await readJoystickThumbOffset(page)).toBeLessThan(0.01);

    await dispatchSyntheticTouchDrag(joystick, 23, { x: 24, y: -28 });
    const cancelledOffset = await cancelTouchAndReadThumbOffset(joystick, 23);
    expect(cancelledOffset).toBeLessThan(0.01);
  });

  test("trusted touch movement changes position and look telemetry", async ({
    page,
  }, testInfo) => {
    test.setTimeout(120_000);
    test.skip(
      testInfo.project.name === "mobile-webkit",
      "mobile-webkit: Playwright has no continuous trusted-touch dispatch channel for WebKit; its non-3D, reader, map, settings, and reset paths remain covered.",
    );

    const root = await enterForest(page);
    // Proximity telemetry also samples the camera during its arrival. Start the
    // ground-movement baseline only after the authored handoff admits walking.
    await expect(root).toHaveAttribute("data-story-transition", "idle", { timeout: 45_000 });
    await expect(root).toHaveAttribute("data-story-actions", "available", { timeout: 45_000 });
    const initial = await waitForTelemetry(root, 45_000);
    expect(
      initial,
      "mobile-chromium must expose WebGL scene telemetry for trusted-touch verification",
    ).not.toBeNull();
    if (!initial) {
      throw new Error(
        "mobile-chromium did not expose WebGL scene telemetry for trusted-touch verification.",
      );
    }

    const controls = page.getByRole("region", {
      name: "Mobile forest controls",
    });
    const joystick = controls.getByRole("group", {
      name: "Analogue movement control",
    });
    const releaseMovement = await beginTrustedChromiumTouchDrag(
      page,
      joystick,
      { x: 0, y: -44 },
    );
    const movementSamples = [initial];
    try {
      await expect
        .poll(async () => {
          const current = await readTelemetry(root);
          if (current) movementSamples.push(current);
          return current ? displacement(initial, current) : 0;
        }, { timeout: 10_000 })
        .toBeGreaterThan(0.03);
    } finally {
      await releaseMovement();
    }
    const movementY = movementSamples.map((sample) => sample.y);
    expect(Math.min(...movementY), "player must not fall through terrain").toBeGreaterThan(-2.5);
    expect(
      Math.max(...movementY) - Math.min(...movementY),
      "short ground movement must not produce an unbounded vertical jump",
    ).toBeLessThan(1.5);

    const beforeLook = await waitForTelemetry(root);
    expect(
      beforeLook,
      "mobile-chromium must retain scene telemetry before trusted look input",
    ).not.toBeNull();
    if (!beforeLook) {
      throw new Error(
        "mobile-chromium lost WebGL scene telemetry before trusted look input.",
      );
    }
    const lookPad = controls.getByRole("group", {
      name: "Drag to look around",
    });
    const releaseLook = await beginTrustedChromiumTouchDrag(page, lookPad, {
      x: 56,
      y: -8,
    });
    try {
      await expect
        .poll(async () => {
          const current = await readTelemetry(root);
          return current ? yawDelta(beforeLook.yaw, current.yaw) : 0;
        }, { timeout: 10_000 })
        .toBeGreaterThan(0.001);
    } finally {
      await releaseLook();
    }
  });
});
