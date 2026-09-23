import { openingEnclosed } from "../../cinematics/openingPresentation";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import type { Slipper3DEntry, Slipper3DVisual } from "../../data/slipper3dTypes";
import StoryScene, {
  type NarrativeWorldState,
  type SceneProximityState,
  type StorySceneControls,
  type StorySceneMode,
} from "./StoryScene";
import MasterPlayerLantern from "./MasterPlayerLantern";
import { deriveLanternNarrative } from "../../lib/lanternNarrative";
import { shouldShowDebugOverlay, type RenderQualityProfile } from "./renderQuality";
import { resolveWorldVisualState } from "./worldVisualState";
import { resolveWorldDirector } from "./worldDirector/worldDirector";
import WorldDirectorDebug from "./worldDirector/WorldDirectorDebug";
import WorldEngineLayer from "./world/WorldEngineLayer";
import type { WorldMemoryState } from "./worldMemory/WorldMemoryDirector";

type StorySceneWithMasterLanternProps = {
  children?: ReactNode;
  entryId: string;
  entries: Slipper3DEntry[];
  visuals: Slipper3DVisual[];
  controls?: StorySceneControls;
  mode?: StorySceneMode;
  fallbackEnvironmentSrc?: string;
  visitedEntryIds?: string[];
  narrativeWorldState?: NarrativeWorldState;
  storyWorldMemory?: WorldMemoryState;
  lockedEntryIds?: string[];
  navigationTargetEntryId?: string | null;
  initialPlayerPosition?: import("../../data/slipper3dTypes").Vector3Tuple | null;
  narrativeAudioSuppressed?: boolean;
  onFinalConstellationFormationComplete?: () => void;
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  onPortalSelect?: (targetEntryId: string) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void;
};

const FALLBACK_WORLD_STATE: NarrativeWorldState = {
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

export function StorySceneWithMasterLantern({
  children,
  narrativeWorldState = FALLBACK_WORLD_STATE,
  controls = "orbit",
  mode = "explore",
  qualityProfile,
  reducedEffects,
  onPlayerProximityChange,
  ...props
}: StorySceneWithMasterLanternProps) {
  const eventDriven = useJourneyStore(state => state.worldFlags["story-events.started"] === true);
  const physicallyCarried = useJourneyStore(state => state.storyObjectStates["lantern.master"] === "carried");
  const [proximity, setProximity] = useState<SceneProximityState | null>(null);

  const activeEntry = useMemo(
    () => props.entries.find((entry) => entry.id === props.entryId) ?? props.entries[0],
    [props.entries, props.entryId],
  );

  const visualState = useMemo(
    () => resolveWorldVisualState({ entry: activeEntry, narrativeWorldState }),
    [activeEntry, narrativeWorldState],
  );

  const handlePlayerProximityChange = useCallback(
    (state: SceneProximityState) => {
      setProximity(state);
      onPlayerProximityChange?.(state);
    },
    [onPlayerProximityChange],
  );

  const navigationTargetPosition =
    proximity?.navigationTargetWorldPosition ?? proximity?.approachingWorldPosition ?? proximity?.nearestWorldPosition ?? null;

  const worldMemory = props.storyWorldMemory;
  const lanternNarrative = useMemo(
    () => deriveLanternNarrative({
      chapterId: worldMemory?.chapterId ?? "broken-floor",
      sceneId: worldMemory?.sceneId ?? "broken-floor.confession",
      completedActs: [...(worldMemory?.completedActs ?? [])],
      completedChapterIds: [...(worldMemory?.completedChapterIds ?? [])],
      completedSceneIds: [...(worldMemory?.completedSceneIds ?? [])],
      completedRitualIds: [...(worldMemory?.completedRitualIds ?? [])],
      worldFlags: { ...(worldMemory?.worldFlags ?? {}) },
      landmarkStates: { ...(worldMemory?.landmarkStates ?? {}) },
      inventory: {
        lantern: worldMemory?.inventory.lantern ?? false,
        recoveredKeys: [...(worldMemory?.inventory.recoveredKeys ?? [])],
        symbolicObjects: [...(worldMemory?.inventory.symbolicObjects ?? [])],
      },
      storyStarted: worldMemory?.storyStarted ?? false,
      storyCompleted: worldMemory?.storyCompleted ?? false,
    }),
    [worldMemory],
  );
  const showCarriedLantern =
    mode === "explore" &&
    lanternNarrative.presence === "carried" && (!eventDriven || physicallyCarried);

  const worldDirector = useMemo(
    () =>
      resolveWorldDirector({
        narrativeWorldState,
        visualState,
        qualityProfile,
        navigationGuidance: Boolean(navigationTargetPosition),
      }),
    [narrativeWorldState, navigationTargetPosition, qualityProfile, visualState],
  );

  // StoryScene resolves the canonical scene's authored origin and heading, then
  // mounts these children inside its single SceneLookDirector. The legacy world
  // and lantern directors provide geometry/navigation inputs, not a second look.
  return (
    <StoryScene
      {...props}
      controls={controls}
      mode={mode}
      narrativeWorldState={narrativeWorldState}
      qualityProfile={qualityProfile}
      reducedEffects={reducedEffects}
      onPlayerProximityChange={handlePlayerProximityChange}
    >
      <WorldEngineLayer
        worldDirector={worldDirector}
        visualState={visualState}
        narrativeWorldState={narrativeWorldState}
        qualityProfile={qualityProfile}
        navigationTargetPosition={navigationTargetPosition}
        enabled={mode !== "map" && !openingEnclosed(worldMemory?.sceneId, Boolean(worldMemory?.inventory.lantern || worldMemory?.completedRitualIds?.includes("ritual.accept-lantern")))}
      />
      {showCarriedLantern ? (
        <MasterPlayerLantern
          narrativeWorldState={narrativeWorldState}
          qualityProfile={qualityProfile}
          narrativePhase={lanternNarrative}
          navigationTargetPosition={eventDriven ? null : navigationTargetPosition}
          reducedEffects={reducedEffects}
        />
      ) : null}
      <WorldDirectorDebug
        worldDirector={worldDirector}
        qualityProfile={qualityProfile}
        narrativeWorldState={narrativeWorldState}
        enabled={shouldShowDebugOverlay()}
      />
      {children}
    </StoryScene>
  );
}

export default StorySceneWithMasterLantern;
