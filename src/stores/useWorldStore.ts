import { create } from "zustand";
import type { NarrativeWorldState, SceneProximityState } from "../components/three/StoryScene";
import type { Vector3Tuple } from "../data/slipper3dTypes";

export type WorldBiome = "firstWood" | "mirror" | "thorned" | "archive" | "fireRiver" | "crowned";
export type WorldMode = "explore" | "read" | "map";
export type WorldControls = "orbit" | "walk" | "none";

const FALLBACK_NARRATIVE_WORLD_STATE: NarrativeWorldState = {
  visitedCount: 1,
  totalCount: 1,
  traceCount: 1,
  fireCount: 0,
  waterCount: 0,
  memoryCount: 0,
  thresholdCount: 0,
  crownCount: 0,
  fireWaterBalance: 0,
  explorationDepth: 0,
  memoryPressure: 0,
  symbolicWeight: 0.5,
};

type WorldStore = {
  mode: WorldMode;
  controls: WorldControls;
  currentBiome: WorldBiome;
  playerPosition: Vector3Tuple;
  nearestEntryId: string | null;
  nearestDistance: number;
  proximityPresence: number;
  sceneProximity: SceneProximityState | null;
  narrativeWorldState: NarrativeWorldState;
  physicsPaused: boolean;
  setMode: (mode: WorldMode | ((current: WorldMode) => WorldMode)) => void;
  setControls: (controls: WorldControls | ((current: WorldControls) => WorldControls)) => void;
  toggleControls: () => void;
  setCurrentBiome: (biome: WorldBiome) => void;
  setPlayerPosition: (position: Vector3Tuple) => void;
  setProximity: (input: { nearestEntryId: string | null; nearestDistance: number; proximityPresence: number }) => void;
  setSceneProximity: (sceneProximity: SceneProximityState | null) => void;
  setNarrativeWorldState: (narrativeWorldState: NarrativeWorldState) => void;
  setPhysicsPaused: (paused: boolean) => void;
};

export const useWorldStore = create<WorldStore>((set) => ({
  mode: "explore",
  controls: "walk",
  currentBiome: "firstWood",
  playerPosition: [0, 0, 0],
  nearestEntryId: null,
  nearestDistance: 999,
  proximityPresence: 0,
  sceneProximity: null,
  narrativeWorldState: FALLBACK_NARRATIVE_WORLD_STATE,
  physicsPaused: false,

  setMode: (mode) => set((state) => ({ mode: typeof mode === "function" ? mode(state.mode) : mode })),
  setControls: (controls) => set((state) => ({ controls: typeof controls === "function" ? controls(state.controls) : controls })),
  toggleControls: () => set((state) => ({ controls: state.controls === "walk" ? "orbit" : "walk" })),
  setCurrentBiome: (currentBiome) => set({ currentBiome }),
  setPlayerPosition: (playerPosition) => set({ playerPosition }),
  setProximity: ({ nearestEntryId, nearestDistance, proximityPresence }) => set({ nearestEntryId, nearestDistance, proximityPresence }),
  setSceneProximity: (sceneProximity) =>
    set({
      sceneProximity,
      playerPosition: sceneProximity?.playerPosition ?? [0, 0, 0],
      nearestEntryId: sceneProximity?.nearestEntryId ?? null,
      nearestDistance: sceneProximity?.distance ?? 999,
      proximityPresence: sceneProximity?.uiPresence ?? 0,
    }),
  setNarrativeWorldState: (narrativeWorldState) => set({ narrativeWorldState }),
  setPhysicsPaused: (physicsPaused) => set({ physicsPaused }),
}));
