import { getJourneySceneForEntry } from "../data/journeyNarrative.ts";

export function isIntegratedFinaleEntry(entryId: string) {
  return getJourneySceneForEntry(entryId)?.id === "epilogue.constellation";
}

export function usesAuthoredCausalComposition(entryId: string) {
  // Every canonical scene now supplies physical objects and material prose.
  // Legacy cards, tag chips and abstract markers would duplicate that layer.
  return Boolean(getJourneySceneForEntry(entryId));
}

export function hasAuthoredChapterMoon(entryId: string) {
  const sceneId = getJourneySceneForEntry(entryId)?.id;
  return isIntegratedFinaleEntry(entryId) ||
    sceneId === "blue-moon.sanctuary" ||
    sceneId === "blue-moon.intimacy" ||
    sceneId === "blue-moon.caged-bird" ||
    sceneId === "wolf-swan.false-choice" ||
    sceneId === "wolf-swan.convergence";
}

