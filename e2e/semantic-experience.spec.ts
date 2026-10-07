import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { readFileSync } from "node:fs";
import {
  completedStoryJourney,
  seedStoryJourney,
} from "./story-first-fixtures";

type StoryEntryFixture = {
  id: string;
  title: string;
  paragraphs: string[];
};

const worldState = JSON.parse(
  readFileSync(
    new URL("../src/data/worldState.json", import.meta.url),
    "utf8",
  ),
) as { entries: StoryEntryFixture[] };
const storyEntries = worldState.entries;
const firstEntry = storyEntries[0];
const unreadEntry = storyEntries.find((entry) => entry.id !== firstEntry?.id);

function isMobileProject(testInfo: TestInfo) {
  return testInfo.project.name.startsWith("mobile-");
}

function middleProseNeedle(paragraphs: string[]) {
  const words = paragraphs
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  const start = Math.max(0, Math.floor(words.length / 2) - 5);
  return words.slice(start, start + 10).join(" ");
}

async function clearStorageOnce(page: Page) {
  await page.goto("/?welcome=1", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload({ waitUntil: "domcontentloaded" });
}

async function openThresholdSettings(page: Page) {
  await page
    .getByRole("button", { name: "Accessibility and sound settings" })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Experience settings",
  });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function openAccessibleArchive(page: Page) {
  const freeWoodsSnapshot = {
    ...completedStoryJourney(),
    activeEntryId: firstEntry!.id,
    history: [],
    visitedEntryIds: [firstEntry!.id],
    witnessedEntryIds: [firstEntry!.id],
  };
  await seedStoryJourney(page, freeWoodsSnapshot, {
    dedicationAcknowledged: true,
  });
  await page.goto("/?accessible=1", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Return to the Woods", exact: true })
    .click();
  await page.getByRole("button", { name: "Archive", exact: true }).click();
  await expect(page).toHaveURL(/\/archive(?:\?accessible=1)?$/);
  await expect(page.locator("#archive-main")).toBeVisible();
}

async function enterFreeWoods(page: Page) {
  const freeWoodsSnapshot = {
    ...completedStoryJourney(),
    activeEntryId: firstEntry!.id,
    history: [],
    visitedEntryIds: [firstEntry!.id],
    witnessedEntryIds: [firstEntry!.id],
  };
  await seedStoryJourney(page, freeWoodsSnapshot, {
    dedicationAcknowledged: true,
  });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Return to the Woods", exact: true })
    .click();
  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-experience-mode", "free-woods");
  return root;
}

test.beforeEach(async ({ page }, testInfo) => {
  if (
    testInfo.title ===
    "honours the system reduced-motion preference on first load"
  ) {
    await page.emulateMedia({ reducedMotion: "reduce" });
  }
  await clearStorageOnce(page);
});

test.describe("threshold, settings, and recovery", () => {
  test("keeps the threshold and ordered text journey usable without WebGL", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        configurable: true,
        value: () => null,
      });
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("dialog", { name: "SLIPPER IN THE WOODS" }),
    ).toBeVisible();
    await expect(
      page.getByText("A journey to you.", { exact: true }),
    ).toBeVisible();

    await page.locator(".onboarding-actions button").click();
    await expect(page.locator("canvas")).toHaveCount(0);
    await expect(page.locator("[data-accessible-journey='true']")).toBeVisible();
    await expect(page.locator("[data-accessible-witness='fragment-001']")).toBeVisible();
    await expect(page.getByRole("button", { name: /archive|map/i })).toHaveCount(0);
  });

  test("traps settings focus, persists choices, and leaves the threshold open", async ({
    page,
  }) => {
    const threshold = page.getByRole("dialog", {
      name: "SLIPPER IN THE WOODS",
    });
    const primaryThresholdAction = threshold.getByRole("button", {
      name: "Begin",
      exact: true,
    });
    const settingsThresholdAction = threshold.getByRole("button", {
      name: "Accessibility and sound settings",
    });
    await expect(primaryThresholdAction).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await expect(settingsThresholdAction).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(primaryThresholdAction).toBeFocused();
    await page.locator("body").evaluate((element) => {
      const body = element as HTMLElement;
      body.tabIndex = -1;
      body.focus();
    });
    await expect(primaryThresholdAction).toBeFocused();

    const dialog = await openThresholdSettings(page);
    const closeButton = dialog.getByRole("button", {
      name: "Close settings",
    });
    await expect(closeButton).toBeFocused();

    await page.keyboard.press("Shift+Tab");
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      )
      .toBe(true);
    await page.locator("body").evaluate((element) => {
      const body = element as HTMLElement;
      body.tabIndex = -1;
      body.focus();
    });
    await expect
      .poll(() =>
        dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      )
      .toBe(true);

    const selectedQuality = dialog.getByRole("radio", { checked: true });
    await selectedQuality.focus();
    await page.keyboard.press("ArrowRight");
    const nextSelectedQuality = dialog.getByRole("radio", { checked: true });
    await expect(nextSelectedQuality).toBeFocused();
    await expect(dialog.locator("[role='radio'][tabindex='0']")).toHaveCount(1);

    const reducedMotion = dialog.getByRole("button", {
      name: /Reduced motion/,
    });
    const reducedEffects = dialog.getByRole("button", {
      name: /Reduced environmental effects/,
    });
    const highContrast = dialog.getByRole("button", {
      name: /High contrast/,
    });
    if ((await reducedMotion.getAttribute("aria-pressed")) !== "true") {
      await reducedMotion.focus();
      await page.keyboard.press("Enter");
    }
    if ((await reducedEffects.getAttribute("aria-pressed")) !== "true") {
      await reducedEffects.focus();
      await page.keyboard.press("Enter");
    }
    if ((await highContrast.getAttribute("aria-pressed")) !== "true") {
      await highContrast.focus();
      await page.keyboard.press("Enter");
    }
    await dialog.getByLabel("Reading surface").selectOption("clean");
    await dialog.getByLabel("Reading text size").fill("1.35");
    await dialog.getByLabel("Movement control side").selectOption("right");
    await dialog.getByLabel("Touch look sensitivity").fill("1.4");

    await expect(page.locator("html")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-effects",
      "reduced",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-contrast",
      "high",
    );
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement)
            .getPropertyValue("--reader-scale")
            .trim(),
        ),
      )
      .toBe("1.35");
    await expect(dialog.getByRole("button", { name: /Gentle haptics/ })).toBeDisabled();

    await closeButton.focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
    await expect(
      page.getByRole("dialog", { name: "SLIPPER IN THE WOODS" }),
    ).toBeVisible();
    await expect(settingsThresholdAction).toBeFocused();
    await expect(threshold).toHaveCSS("background-color", "rgb(0, 0, 0)");
    await expect(threshold.locator("h1")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(threshold.locator(".onboarding-copy")).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(settingsThresholdAction).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(primaryThresholdAction).toHaveCSS("background-color", "rgb(255, 255, 255)");
    await expect(primaryThresholdAction).toHaveCSS("color", "rgb(0, 0, 0)");
    await expect
      .poll(() =>
        page.evaluate(
          () => localStorage.getItem("sidtw:onboarding-complete:v1"),
        ),
      )
      .not.toBe("true");

    await page.reload({ waitUntil: "domcontentloaded" });
    const reopened = await openThresholdSettings(page);
    await expect(
      reopened.getByRole("button", { name: /Reduced motion/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      reopened.getByRole("button", {
        name: /Reduced environmental effects/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      reopened.getByRole("button", { name: /High contrast/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-contrast",
      "high",
    );
    await expect(reopened.getByLabel("Reading surface")).toHaveValue("clean");
    await expect(reopened.getByLabel("Reading text size")).toHaveValue("1.35");
    await expect(reopened.getByLabel("Movement control side")).toHaveValue(
      "right",
    );
    await expect(reopened.getByLabel("Touch look sensitivity")).toHaveValue(
      "1.4",
    );
    await reopened
      .getByRole("button", { name: "Close settings" })
      .focus();
    await page.keyboard.press("Enter");
    await expect(reopened).toBeHidden();

    await openAccessibleArchive(page);
    const currentArticle = page.locator("article[aria-current='location']");
    await currentArticle.getByRole("button", { name: "Read here" }).click();
    await expect
      .poll(() =>
        currentArticle
          .locator(".accessible-archive-fragment-body")
          .evaluate((element) => parseFloat(getComputedStyle(element).fontSize)),
      )
      .toBeGreaterThan(20);
  });

  test("sanitizes invalid current and legacy journey snapshots", async ({
    page,
  }) => {
    await page.evaluate(() => {
      localStorage.setItem(
        "sidtw:journey:v3",
        JSON.stringify({
          state: {
            activeEntryId: "not-a-real-entry",
            history: ["missing-history-entry", 42, null],
            visitedEntryIds: ["missing-visited-entry"],
            bookmarkedEntryIds: ["missing-bookmark"],
            lastSafeEntryId: "missing-safe-entry",
            playerPosition: [Number.POSITIVE_INFINITY, "north", null],
            updatedAt: "not-a-date",
          },
          version: 3,
        }),
      );
      localStorage.setItem(
        "slipper-3d-journey-v1",
        JSON.stringify({
          activeEntryId: 42,
          history: "invalid",
          visitedEntryIds: [null, "missing"],
        }),
      );
    });
    await page.reload({ waitUntil: "domcontentloaded" });

    await expect(
      page.getByRole("dialog", { name: "SLIPPER IN THE WOODS" }),
    ).toBeVisible();
    await expect(page.locator(".fatal-fallback")).toHaveCount(0);

    await page.locator(".onboarding-actions button").click();
    const journey = page.locator(
      "[data-experience-root], [data-accessible-journey='true']",
    );
    await expect(journey).toHaveAttribute("data-active-entry", firstEntry!.id);
    await expect(page.locator("#archive-main")).toHaveCount(0);
  });

  test("honours the system reduced-motion preference on first load", async ({
    page,
  }) => {
    const dialog = await openThresholdSettings(page);
    await expect(
      dialog.getByRole("button", { name: /Reduced motion/ }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      dialog.getByRole("button", {
        name: /Reduced environmental effects/,
      }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("html")).toHaveAttribute(
      "data-motion",
      "reduced",
    );
    await expect(page.locator("html")).toHaveAttribute(
      "data-effects",
      "reduced",
    );
    await dialog.getByRole("button", { name: "Close settings" }).focus();
    await page.keyboard.press("Enter");
    await expect(dialog).toBeHidden();
  });
});

test.describe("semantic archive and reader", () => {
  test("reveals visited prose but excludes unread prose from search and the DOM", async ({
    page,
  }) => {
    test.skip(
      !firstEntry || !unreadEntry,
      "The generated story needs at least two fragments for disclosure coverage.",
    );
    await openAccessibleArchive(page);

    const archiveSkipLink = page.getByRole("link", {
      name: "Skip to fragments",
    });
    await archiveSkipLink.focus();
    await page.keyboard.press("Enter");
    await expect(page.locator("#archive-fragments")).toBeFocused();

    const unreadHeading = page.getByRole("heading", {
      level: 3,
      name: unreadEntry!.title,
      exact: true,
    });
    const unreadArticle = page.locator("article").filter({
      has: unreadHeading,
    });
    await expect(unreadArticle).toContainText(
      "Its title and location are available, but its prose is not shown.",
    );
    await expect(
      unreadArticle.locator(".accessible-archive-fragment-body"),
    ).toHaveCount(0);
    await expect(
      unreadArticle.getByRole("button", {
        name: /Enter unread memory in the text journey:/,
      }),
    ).toBeVisible();

    const unreadNeedle = middleProseNeedle(unreadEntry!.paragraphs);
    expect(unreadNeedle.length).toBeGreaterThan(20);
    const search = page.getByLabel(
      "Search titles, themes, symbols, or remembered text",
    );
    await search.fill(unreadNeedle);
    await expect(page.getByRole("status")).toContainText(
      "Unread prose is intentionally excluded from search.",
    );
    await expect(unreadHeading).toHaveCount(0);

    await search.fill(unreadEntry!.title);
    await expect(unreadHeading).toBeVisible();
    await expect(
      page.locator(".accessible-archive-fragment-body"),
    ).toHaveCount(0);

    await search.fill("");
    const currentArticle = page.locator(
      "article[aria-current='location']",
    );
    await currentArticle
      .getByRole("button", { name: "Read here" })
      .click();
    await expect(
      currentArticle.locator(".accessible-archive-fragment-body"),
    ).toBeVisible();
    await expect(
      currentArticle.locator(".accessible-archive-fragment-body p").first(),
    ).toHaveText(firstEntry!.paragraphs[0]);
  });

  test("tracks reader progress and supports bookmark, map, archive, and return", async ({
    page,
  }, testInfo) => {
    // Software-rendered WebGL plus trace capture can make each actionability
    // check expensive even though the semantic controls remain stable.
    test.slow();
    page.setDefaultTimeout(45_000);
    const root = await enterFreeWoods(page);
    if (isMobileProject(testInfo)) {
      const mobileControls = page.getByRole("region", {
        name: "Mobile forest controls",
      });
      await mobileControls.getByRole("button", { name: "More", exact: true }).click();
      await mobileControls.getByRole("button", { name: "Archive", exact: true }).click();
    } else {
      await page
        .getByRole("region", { name: "Slipper in the Woods navigation" })
        .getByRole("button", { name: "Archive", exact: true })
        .click();
    }
    const currentArticle = page.locator("article[aria-current='location']");
    await currentArticle
      .getByRole("button", {
        name: /Open current remembered fragment in focused reading mode:/,
      })
      .click();
    await page
      .getByRole("group", { name: "Story modes" })
      .getByRole("button", { name: "Fragment", exact: true })
      .click();

    const reader = page.getByRole("region", {
      name: "Focused reading mode",
    });
    const progress = reader.getByRole("progressbar", {
      name: "Reading progress",
    });
    await expect(reader).toBeVisible();
    await expect(root).toHaveAttribute("data-world-mode", "read");
    await expect(progress).toHaveAttribute("aria-valuenow", "0");
    const readerDocument = reader.getByRole("document", {
      name: firstEntry!.title,
    });
    await expect(readerDocument).toBeFocused();

    await reader.locator(".reader-panel-inner").evaluate((element) => {
      element.scrollTop = element.scrollHeight;
      element.dispatchEvent(new Event("scroll", { bubbles: true }));
    });
    await expect
      .poll(async () =>
        Number((await progress.getAttribute("aria-valuenow")) ?? "0"),
      )
      .toBeGreaterThan(0);

    const bookmark = reader.getByRole("button", {
      name: "Bookmark location",
    });
    await bookmark.click();
    await expect(
      reader.getByRole("button", { name: "Remove bookmark" }),
    ).toHaveAttribute("aria-pressed", "true");

    await reader.getByRole("button", { name: "Open map" }).click();
    await expect(root).toHaveAttribute("data-world-mode", "map");
    await expect(
      page.getByRole("region", { name: "Story map workspace" }),
    ).toBeVisible();

    const navigation = page.getByRole("region", {
      name: "Slipper in the Woods navigation",
    });
    await navigation
      .getByRole("button", { name: "Fragment", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Focused reading mode" })
      .getByRole("button", { name: "Open archive" })
      .click();
    await expect(page).toHaveURL(/\/archive$/);
    await expect(page.locator("#archive-main")).toBeVisible();

    await page
      .locator("article[aria-current='location']")
      .getByRole("button", {
        name: /Open current remembered fragment in focused reading mode:/,
      })
      .click();
    await page
      .getByRole("group", { name: "Story modes" })
      .getByRole("button", { name: "Fragment", exact: true })
      .click();
    await page
      .getByRole("region", { name: "Focused reading mode" })
      .getByRole("button", { name: "Return to forest" })
      .click();
    await expect(root).toHaveAttribute("data-world-mode", "explore");
  });
});

test("desktop exposes keyboard navigation and never mounts the mobile overlay", async ({
  page,
}, testInfo) => {
  test.skip(
    isMobileProject(testInfo),
    "Desktop-only coverage verifies the keyboard surface and absence of touch controls.",
  );

  await seedStoryJourney(page, completedStoryJourney(), {
    dedicationAcknowledged: true,
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .getByRole("button", { name: "Return to the Woods", exact: true })
    .click();

  await expect(page.getByLabel("Touch controls")).toBeHidden();

  const root = page.locator("[data-experience-root]");
  await expect(root).toHaveAttribute("data-world-mode", "explore");
  await expect(
    page.getByRole("region", { name: "Mobile forest controls" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("region", {
      name: "Slipper in the Woods navigation",
    }),
  ).toBeVisible();
  const navigation = page.getByRole("region", {
    name: "Slipper in the Woods navigation",
  });
  const skipLink = page.getByRole("link", {
    name: "Skip to story navigation",
  });
  await skipLink.focus();
  await page.keyboard.press("Enter");
  await expect(navigation).toBeFocused();

  await navigation.evaluate((element) => {
    const navigationElement = element as HTMLElement;
    navigationElement.style.opacity = "0.06";
    navigationElement.style.pointerEvents = "none";
  });
  const forestMode = navigation.getByRole("button", {
    name: "Forest",
    exact: true,
  });
  await forestMode.focus();
  await expect(forestMode).toBeFocused();
  await expect(navigation).toHaveCSS("opacity", "1");
  await expect(navigation).toHaveCSS("pointer-events", "auto");

  await page.evaluate(() => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  });
  await expect(root).toHaveAttribute("data-story-actions", "available");
  await expect(root).toHaveAttribute("data-story-prose", "available");
  await page.keyboard.press("f");
  await expect(root).toHaveAttribute("data-world-mode", "read");
  await expect(
    page.getByRole("region", { name: "Focused reading mode" }),
  ).toBeVisible();
});
