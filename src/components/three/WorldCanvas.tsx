import {
  Component,
  memo,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  type ErrorInfo,
  type ReactNode,
} from "react";
import { Html, OrbitControls, Stars } from "@react-three/drei";
import { CuboidCollider, Physics, RigidBody } from "@react-three/rapier";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getJourneyChapterForEntry } from "../../data/journeyNarrative";
import type { Slipper3DEntry, Slipper3DVisual, Vector3Tuple } from "../../data/slipper3dTypes";
import { useSettingsStore } from "../../stores/useSettingsStore";
import StorySceneWithMasterLantern from "./StorySceneWithMasterLantern";
import { resolveEnvironmentalEffectsProfile, resolveNarrativeRenderScale, useRenderQualityProfile } from "./renderQuality";
import type { NarrativeWorldState, SceneProximityState, StorySceneControls, StorySceneMode } from "./StoryScene";
import { resolveWorldVisualState } from "./worldVisualState";
import type { WorldMemoryState } from "./worldMemory/WorldMemoryDirector";

type WorldCanvasProps = {
  entryId: string;
  entries: Slipper3DEntry[];
  visuals: Slipper3DVisual[];
  visitedEntryIds?: string[];
  narrativeWorldState?: NarrativeWorldState;
  storyWorldMemory?: WorldMemoryState;
  lockedEntryIds?: string[];
  navigationTargetEntryId?: string | null;
  initialPlayerPosition?: Vector3Tuple | null;
  narrativeAudioSuppressed?: boolean;
  onFinalConstellationFormationComplete?: () => void;
  onPortalSelect?: (targetEntryId: string) => void;
  onMapSelectEntry?: (targetEntryId: string) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void;
  controls?: StorySceneControls;
  mode?: StorySceneMode;
};

const FALLBACK_STATE: NarrativeWorldState = {
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

type WorldCanvasErrorBoundaryState = { hasError: boolean; message?: string };

class WorldCanvasErrorBoundary extends Component<{ children: ReactNode }, WorldCanvasErrorBoundaryState> {
  state: WorldCanvasErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): WorldCanvasErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Slipper world render failed:", error, info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="slipper-canvas-crash-fallback" role="alert">
        <div className="slipper-canvas-crash-card">
          <p className="slipper-canvas-crash-kicker">The wood failed to open</p>
          <h1>Slipper in the Woods</h1>
          <p>The 3D renderer hit a runtime error. Refresh once after the latest deployment finishes, or switch to Map/Read mode while assets settle.</p>
          {this.state.message ? <code>{this.state.message}</code> : null}
        </div>
      </div>
    );
  }
}

function CanvasRendererController({
  narrativeWorldState,
  exposure,
  cinematicActive,
}: {
  narrativeWorldState: NarrativeWorldState;
  exposure?: number;
  cinematicActive: boolean;
}) {
  const { gl } = useThree();
  const targetExposure =
    exposure ??
    THREE.MathUtils.clamp(
      1.12 -
        narrativeWorldState.memoryPressure * 0.08 +
        narrativeWorldState.explorationDepth * 0.035,
      0.98,
      1.34,
    );
  const targetExposureRef = useRef(targetExposure);

  useEffect(() => {
    targetExposureRef.current = targetExposure;
  }, [targetExposure]);

  useEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = targetExposureRef.current;
    gl.outputColorSpace = THREE.SRGBColorSpace;
  }, [gl]);

  useFrame((_, delta) => {
    if (cinematicActive) return;
    gl.toneMappingExposure = THREE.MathUtils.lerp(
      gl.toneMappingExposure,
      targetExposureRef.current,
      1 - Math.exp(-Math.min(delta, 0.05) * 3.2),
    );
  });

  return null;
}

function SceneLoader() {
  return (
    <Html center>
      <div className="slipper-scene-loader">Loading the wood...</div>
    </Html>
  );
}

function MapFallbackScene({
  entries,
  activeEntryId,
  visitedEntryIds,
  onSelectEntry,
}: {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  onSelectEntry?: (targetEntryId: string) => void;
}) {
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const activeEntry = useMemo(() => entries.find((entry) => entry.id === activeEntryId) ?? entries[0], [activeEntryId, entries]);
  const visibleEntries = useMemo(() => entries.slice(0, 18), [entries]);

  return (
    <>
      <color attach="background" args={["#050608"]} />
      <fog attach="fog" args={["#07080a", 12, 34]} />
      <ambientLight intensity={0.88} />
      <hemisphereLight args={["#d9e7ff", "#12120d", 0.42]} />
      <Stars radius={36} depth={18} count={1600} factor={2.2} saturation={0} fade speed={0.07} />
      <Html center zIndexRange={[20, 0]}>
        <div className="slipper-map-fallback-panel">
          <p className="slipper-map-fallback-kicker">Memory constellation</p>
          <h2>{activeEntry?.title ?? "The archive"}</h2>
          <p className="slipper-map-fallback-copy">Choose a clearing below, or use the full archive panel outside the canvas.</p>
          <div className="slipper-map-fallback-grid">
            {visibleEntries.map((entry) => {
              const isActive = entry.id === activeEntryId;
              const isVisited = visitedSet.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`${isActive ? "is-active" : ""} ${isVisited ? "is-visited" : ""}`}
                  onClick={() => onSelectEntry?.(entry.id)}
                >
                  <span>{getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}</span>
                  <strong>{entry.title}</strong>
                </button>
              );
            })}
          </div>
        </div>
      </Html>
      <OrbitControls enablePan={false} enableDamping dampingFactor={0.08} rotateSpeed={0.24} minDistance={5.5} maxDistance={16} />
    </>
  );
}

export function WorldCanvas({
  entryId,
  entries,
  visuals,
  visitedEntryIds = [],
  narrativeWorldState = FALLBACK_STATE,
  storyWorldMemory,
  lockedEntryIds = [],
  navigationTargetEntryId = null,
  initialPlayerPosition = null,
  narrativeAudioSuppressed = false,
  onFinalConstellationFormationComplete,
  onPortalSelect,
  onMapSelectEntry,
  onPlayerProximityChange,
  controls = "orbit",
  mode = "explore",
}: WorldCanvasProps) {
  const requestedQualityProfile = useRenderQualityProfile();
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const qualityProfile = useMemo(
    () => resolveEnvironmentalEffectsProfile(requestedQualityProfile, reducedEffects),
    [reducedEffects, requestedQualityProfile],
  );
  const renderScale = useMemo(
    () => resolveNarrativeRenderScale({ qualityProfile, narrativeWorldState }),
    [
      qualityProfile,
      narrativeWorldState.memoryPressure,
      narrativeWorldState.explorationDepth,
      narrativeWorldState.fireWaterBalance,
      narrativeWorldState.symbolicWeight,
    ],
  );
  const canvasDpr = useMemo<[number, number]>(() => [0.78, Math.max(0.78, renderScale.effectivePixelRatio)], [renderScale.effectivePixelRatio]);
  const activeEntry = useMemo(
    () => entries.find((entry) => entry.id === entryId) ?? entries[0],
    [entries, entryId],
  );
  const activeExposure = useMemo(
    () =>
      mode === "map" || !activeEntry
        ? undefined
        : resolveWorldVisualState({
            entry: activeEntry,
            nearestEntry: activeEntry,
            nearestDistance: 0,
            narrativeWorldState,
          }).exposure,
    [activeEntry, mode, narrativeWorldState],
  );
  const shadowsEnabled = qualityProfile.enableMoonShadows || qualityProfile.enableLanternShadows;

  return (
    <WorldCanvasErrorBoundary>
      <Canvas
        className="slipper-world-canvas"
        camera={{ fov: 65, position: [0, 0, 0.1], near: 0.12, far: 520 }}
        dpr={canvasDpr}
        gl={{
          antialias: false,
          alpha: false,
          powerPreference: "high-performance",
          failIfMajorPerformanceCaveat: false,
          stencil: false,
          depth: true,
        }}
        shadows={shadowsEnabled ? "soft" : false}
        style={{
          width: "var(--app-width, 100vw)",
          height: "var(--app-height, 100dvh)",
          background: "#060706",
        }}
        performance={{ min: 0.5, debounce: 260 }}
        fallback={
          <div className="slipper-canvas-crash-fallback" role="alert">
            <div className="slipper-canvas-crash-card">
              <p className="slipper-canvas-crash-kicker">WebGL unavailable</p>
              <h1>Slipper in the Woods</h1>
              <p>Your browser could not start WebGL for the 3D scene. Try another browser or disable low-power/strict graphics mode.</p>
            </div>
          </div>
        }
      >
        <CanvasRendererController narrativeWorldState={narrativeWorldState} exposure={activeExposure} cinematicActive={mode === "explore"} />
        <Suspense fallback={<SceneLoader />}>
          {mode === "map" ? (
            <MapFallbackScene
              entries={entries}
              activeEntryId={entryId}
              visitedEntryIds={visitedEntryIds}
              onSelectEntry={onMapSelectEntry ?? onPortalSelect}
            />
          ) : (
            <Physics gravity={[0, -9.81, 0]} interpolate={false} colliders={false}>
              <RigidBody type="fixed" colliders={false}>
                <CuboidCollider args={[420, 0.1, 420]} position={[0, -3, 0]} />
              </RigidBody>
              <StorySceneWithMasterLantern
                entryId={entryId}
                entries={entries}
                visuals={visuals}
                controls={controls}
                mode={mode}
                visitedEntryIds={visitedEntryIds}
                narrativeWorldState={narrativeWorldState}
                storyWorldMemory={storyWorldMemory}
                lockedEntryIds={lockedEntryIds}
                navigationTargetEntryId={navigationTargetEntryId}
                initialPlayerPosition={initialPlayerPosition}
                narrativeAudioSuppressed={narrativeAudioSuppressed}
                onFinalConstellationFormationComplete={
                  onFinalConstellationFormationComplete
                }
                qualityProfile={qualityProfile}
                reducedEffects={reducedEffects}
                onPortalSelect={onPortalSelect}
                onPlayerProximityChange={onPlayerProximityChange}
              />
            </Physics>
          )}
        </Suspense>
      </Canvas>
    </WorldCanvasErrorBoundary>
  );
}

export default memo(WorldCanvas);
