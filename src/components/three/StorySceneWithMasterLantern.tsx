import { resolveLanternGuidanceTarget } from "../../ui/lanternGuidancePresentation";
import type { QuietGuidanceActivity } from "../../ui/quietGuidancePresentation";
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
import { useSceneLook } from "./artDirection/SceneLookContext";
import type { Vector3Tuple } from "../../data/slipper3dTypes";
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
  quietGuidanceActivity?: QuietGuidanceActivity;
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

  const handlePlayerProximityChange = useCallback(
    (state: SceneProximityState) => {
      setProximity(state);
      onPlayerProximityChange?.(state);
    },
    [onPlayerProximityChange],
  );

  const navigationTargetPosition = useMemo(() =>
    resolveLanternGuidanceTarget(props.entries, props.navigationTargetEntryId),
    [props.entries, props.navigationTargetEntryId]);

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

  // StoryScene resolves the canonical scene's authored origin and heading, then
  // mounts these children inside its single SceneLookDirector. Legacy projection
  // is evaluated only for a noncanonical fallback or an explicitly enabled debug view.
  return (
    <StoryScene
      {...props}
      controls={controls}
      mode={mode}
      narrativeWorldState={narrativeWorldState}
      qualityProfile={qualityProfile}
      reducedEffects={reducedEffects}
      ambientParticlesEnabled={mode !== "map" && !openingEnclosed(worldMemory?.sceneId, Boolean(worldMemory?.inventory.lantern || worldMemory?.completedRitualIds?.includes("ritual.accept-lantern")))}
      onPlayerProximityChange={handlePlayerProximityChange}
    >
      <WorldPresentationCompatibility
        entryId={props.entryId} entries={props.entries} narrativeWorldState={narrativeWorldState}
        qualityProfile={qualityProfile} navigationTargetPosition={navigationTargetPosition}
        enabled={mode !== "map" && !openingEnclosed(worldMemory?.sceneId, Boolean(worldMemory?.inventory.lantern || worldMemory?.completedRitualIds?.includes("ritual.accept-lantern")))}
        debug={shouldShowDebugOverlay()}
      />
      {showCarriedLantern ? (
        <MasterPlayerLantern
          narrativeWorldState={narrativeWorldState}
          qualityProfile={qualityProfile}
          narrativePhase={lanternNarrative}
          navigationTargetPosition={navigationTargetPosition}
          reducedEffects={reducedEffects}
        />
      ) : null}
      {children}
    </StoryScene>
  );
}

export default StorySceneWithMasterLantern;


type WorldProjectionProps = {
  entryId: string; entries: Slipper3DEntry[]; narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile; navigationTargetPosition: Vector3Tuple | null;
  enabled: boolean; debug: boolean;
};

/** Canonical air needs no legacy environment or aggregate lantern derivation. */
function WorldPresentationCompatibility(props: WorldProjectionProps) {
  const presentation = useSceneLook();
  if (presentation && !props.debug) return null;
  return <LegacyWorldProjection {...props} fallback={!presentation} />;
}

function LegacyWorldProjection({ entryId, entries, narrativeWorldState, qualityProfile, navigationTargetPosition, enabled, debug, fallback }: WorldProjectionProps & { fallback: boolean }) {
  const entry = useMemo(() => entries.find(candidate => candidate.id === entryId) ?? entries[0], [entries, entryId]);
  const visualState = useMemo(() => resolveWorldVisualState({ entry, narrativeWorldState }), [entry, narrativeWorldState]);
  const worldDirector = useMemo(() => resolveWorldDirector({ narrativeWorldState, visualState, qualityProfile, navigationGuidance: Boolean(navigationTargetPosition) }), [narrativeWorldState, visualState, qualityProfile, navigationTargetPosition]);
  return <>
    {fallback && enabled ? <WorldEngineLayer worldDirector={worldDirector} visualState={visualState} narrativeWorldState={narrativeWorldState} qualityProfile={qualityProfile} navigationTargetPosition={navigationTargetPosition} enabled /> : null}
    {debug ? <WorldDirectorDebug worldDirector={worldDirector} qualityProfile={qualityProfile} narrativeWorldState={narrativeWorldState} enabled /> : null}
  </>;
}
