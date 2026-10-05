import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeGeneratedWorldState } from "../src/data/worldStateNormalization.ts";
import { journeyScenes } from "../src/data/journeyNarrative.ts";
import { getJourneyEntryWorldPosition } from "../src/data/journeyWorldLayout.ts";

const repositoryRoot = fileURLToPath(new URL("../", import.meta.url));
const rawWorldState = JSON.parse(
  readFileSync(path.join(repositoryRoot, "src/data/worldState.json"), "utf8"),
);

test("all generated entries normalize to canonical, resolvable visual references", () => {
  const normalized = normalizeGeneratedWorldState(rawWorldState);
  const visualsById = new Map(normalized.visuals.map((visual) => [visual.id, visual]));

  assert.equal(normalized.entries.length, 66);
  assert.equal(normalized.entries.length, rawWorldState.entries.length);
  assert.equal(normalized.visuals.length, rawWorldState.visuals.length);

  for (const entry of normalized.entries) {
    assert.equal(
      Object.hasOwn(entry, "linkedVisualId"),
      false,
      `${entry.id} should expose its visual only through engine3d.linkedVisualId`,
    );
    const visual = visualsById.get(entry.engine3d.linkedVisualId);
    assert.ok(visual, `${entry.id} should resolve visual ${entry.engine3d.linkedVisualId}`);
    assert.ok(
      existsSync(path.join(repositoryRoot, "public", visual.src.slice(1))),
      `${entry.id} should resolve an existing public asset at ${visual.src}`,
    );
  }
});

test("the reconstructed journey drives the 3D layout before legacy archive coordinates", () => {
  const [openingScene, nextScene] = journeyScenes;
  const openingPosition = getJourneyEntryWorldPosition(openingScene.keystoneEntryId);
  const nextPosition = getJourneyEntryWorldPosition(nextScene.keystoneEntryId);

  assert.ok(openingPosition);
  assert.ok(nextPosition);
  assert.ok(
    Math.hypot(
      nextPosition[0] - openingPosition[0],
      nextPosition[2] - openingPosition[2],
    ) < 30,
    "the Broken Floor should feed a compact first authored threshold",
  );

  for (const sourcePath of [
    "src/world/terrain/worldPlacement.ts",
    "src/lib/worldLayout.ts",
    "src/workers/pathWorker.ts",
  ]) {
    const source = readFileSync(path.join(repositoryRoot, sourcePath), "utf8");
    assert.match(
      source,
      /const narrativePosition = getJourneyEntryWorldPosition\(entry\.id\);[\s\S]*?if \(narrativePosition\) return \[\.\.\.narrativePosition\];[\s\S]*?const authored = entry\.engine3d\.worldPosition;/,
      `${sourcePath} should prefer the reconstructed narrative placement`,
    );
  }
});

test("world normalization rejects conflicting legacy and canonical visual references", () => {
  assert.throws(
    () =>
      normalizeGeneratedWorldState({
        entries: [
          {
            id: "conflicting-entry",
            title: "Conflicting entry",
            chapter: "Test",
            tags: [],
            body: "Test body",
            paragraphs: ["Test body"],
            linkedVisualId: "visual-legacy",
            engine3d: { linkedVisualId: "visual-canonical" },
          },
        ],
        visuals: [
          { id: "visual-legacy", src: "/visuals/legacy.jpg", orientation: "portrait" },
          { id: "visual-canonical", src: "/visuals/canonical.jpg", orientation: "portrait" },
        ],
      }),
    /conflicting visual references/,
  );
});
