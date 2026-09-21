import worldState from "./worldState.json" with { type: "json" };
import type { ContentDiagnostics } from "./slipper3dTypes";
import { normalizeGeneratedWorldState } from "./worldStateNormalization";
import { applySlipperGiftOverrides } from "./privateContentOverlay";
import { privateGiftOverrideFile } from "./privateContentOverlayRuntime";

const generatedWorldState = normalizeGeneratedWorldState(worldState);
const privateOverlay = applySlipperGiftOverrides(
  generatedWorldState.entries,
  privateGiftOverrideFile,
);

export const entries = privateOverlay.entries;
export const visuals = generatedWorldState.visuals;
export const appliedPrivateFragmentIds = privateOverlay.appliedFragmentIds;

function duplicateIds(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  return Array.from(duplicates);
}

function buildRuntimeDiagnostics(): ContentDiagnostics {
  const visualIds = new Set(visuals.map((visual) => visual.id));

  return {
    entryCount: entries.length,
    visualCount: visuals.length,
    chapterCount: new Set(entries.map((entry) => entry.chapter)).size,
    tagCount: new Set(entries.flatMap((entry) => entry.tags)).size,
    entriesMissingParagraphs: entries.filter((entry) => entry.paragraphs.length === 0).map((entry) => entry.id),
    entriesUsingFallbackVisual: entries
      .filter((entry) => !visualIds.has(entry.engine3d.linkedVisualId))
      .map((entry) => entry.id),
    duplicateEntryIds: duplicateIds(entries.map((entry) => entry.id)),
    duplicateVisualIds: duplicateIds(visuals.map((visual) => visual.id)),
  };
}

export const contentDiagnostics = buildRuntimeDiagnostics();

export const slipperContent = {
  entries,
  visuals,
  diagnostics: contentDiagnostics,
  generatedAt: generatedWorldState.generatedAt,
  version: generatedWorldState.version,
  stats: generatedWorldState.stats,
  appliedPrivateFragmentIds,
};
