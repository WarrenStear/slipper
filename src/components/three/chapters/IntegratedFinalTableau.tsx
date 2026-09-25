import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { FinalWoodlandDetails } from "../environment/WoodlandDetails";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import { ReverseMemoryLights } from "../storyEvents/ReverseMemoryLights";
import { memoryStarPosition } from "../../../lib/journeyMemoryProjection";
import { memo, useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { JOURNEY_ENTRY_CONTEXT, journeyChapters } from "../../../data/journeyNarrative.ts";
import {
  buildStoryConstellationModel,
  type ConstellationStoryModel,
} from "../../../lib/lanternNarrative.ts";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import type { RenderQualityProfile } from "../renderQuality";
import {
  LanternProp,
  SceneGround,
  qualityStep,
  type Vec3,
} from "./ChapterPrimitives";

type FinalTableauProps = {
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  onFinalConstellationFormationComplete?: () => void;
};

const CANONICAL_ENTRY_IDS = journeyChapters.flatMap((chapter) => chapter.entryIds);
const CANONICAL_ENTRY_ID_SET = new Set<string>(CANONICAL_ENTRY_IDS);
const CONSTELLATION_FORMATION_CENTER: Vec3 = [0, 9.6, -20];
const CONSTELLATION_FORMATION_COMPLETE_THRESHOLD = 0.995;
const CONSTELLATION_MAX_FRAME_DELTA = 0.25;
const FINAL_GROUND_Y = -0.16;

const FINAL_TREE_POSITIONS: readonly Vec3[] = [
  [-14.5, 0, -15],
  [10.5, 0, -16.5],
  [-16, 0, -21.5],
  [13.5, 0, -22],
  [-12.5, 0, -27],
  [8.5, 0, -27],
  [-18, 0, -28],
  [16.5, 0, -28],
];

function pointsGeometry(points: readonly Vec3[]) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(points.flatMap((point) => point), 3),
  );
  return geometry;
}

function lineGeometry(points: readonly Vec3[]) {
  const coordinates: number[] = [];
  for (let index = 1; index < points.length; index += 1) {
    coordinates.push(...points[index - 1], ...points[index]);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(coordinates, 3));
  return geometry;
}

/**
 * The epilogue sky is not a decorative, fixed star chart. Its nodes and lines
 * are built from the memories the current save has actually witnessed, in the
 * order they were encountered. Keystone memories retain a warmer prominence.
 */
const WitnessedMemoryConstellation = memo(function WitnessedMemoryConstellation({
  model,
  formationReady,
  reducedEffects,
  reducedMotion,
  onFormationComplete,
}: {
  model: ConstellationStoryModel;
  formationReady: boolean;
  reducedEffects: boolean;
  reducedMotion: boolean;
  onFormationComplete?: () => void;
}) {
  const formationRef = useRef<THREE.Group>(null);
  const formationProgressRef = useRef(reducedMotion && formationReady ? 1 : 0);
  const formationCompleteReportedRef = useRef(false);
  const onFormationCompleteRef = useRef(onFormationComplete);

  useEffect(() => {
    onFormationCompleteRef.current = onFormationComplete;
  }, [onFormationComplete]);
  const witnessedNodes = useMemo(
    () => model.nodes.filter((node) => node.witnessed && CANONICAL_ENTRY_ID_SET.has(node.entryId)),
    [model.nodes],
  );
  const historyPoints = useMemo(
    () => witnessedNodes.map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const keystonePoints = useMemo(
    () => witnessedNodes
      .filter((node) => JOURNEY_ENTRY_CONTEXT[node.entryId]?.role === "keystone")
      .map((node) => memoryStarPosition(node.entryId)),
    [witnessedNodes],
  );
  const routePoints = useMemo(
    () => model.routeEntryIds.filter((entryId) => CANONICAL_ENTRY_ID_SET.has(entryId)).map(memoryStarPosition),
    [model.routeEntryIds],
  );
  const historyGeometry = useMemo(() => pointsGeometry(historyPoints), [historyPoints]);
  const keystoneGeometry = useMemo(() => pointsGeometry(keystonePoints), [keystonePoints]);
  const threadGeometry = useMemo(() => lineGeometry(routePoints), [routePoints]);
  useEffect(() => () => historyGeometry.dispose(), [historyGeometry]);
  useEffect(() => () => keystoneGeometry.dispose(), [keystoneGeometry]);
  useEffect(() => () => threadGeometry.dispose(), [threadGeometry]);

  useFrame((_, delta) => {
    const formation = formationRef.current;
    if (!formation) return;
    const target = formationReady ? 1 : 0;
    const progress = reducedMotion
      ? target
      : THREE.MathUtils.damp(
          formationProgressRef.current,
          target,
          0.85,
          Math.min(delta, CONSTELLATION_MAX_FRAME_DELTA),
        );
    formationProgressRef.current = progress;
    const eased = THREE.MathUtils.smootherstep(progress, 0, 1);
    formation.visible = eased > 0.003;
    formation.scale.setScalar(0.02 + eased * 0.98);
    formation.position.y = CONSTELLATION_FORMATION_CENTER[1] - (1 - eased) * 0.7;
    formation.rotation.z = (1 - eased) * 0.06;
    formation.userData.formationProgress = Number(eased.toFixed(3));
    const formationComplete =
      formationReady &&
      (reducedMotion || eased >= CONSTELLATION_FORMATION_COMPLETE_THRESHOLD);
    formation.userData.formationComplete = formationComplete;
    if (formationComplete && !formationCompleteReportedRef.current) {
      formationCompleteReportedRef.current = true;
      onFormationCompleteRef.current?.();
    } else if (!formationReady) {
      formationCompleteReportedRef.current = false;
    }
  });

  if (witnessedNodes.length === 0) return null;

  return (
    <group
      name="witnessed-memory-constellation"
      userData={{
        witnessedCount: witnessedNodes.length,
        completedChapterCount: model.progress.completedChapters,
        completedRitualCount: model.progress.completedRituals,
        transformedLandmarkCount: model.landmarkMemory.transformedCount + model.landmarkMemory.releasedCount,
        routeStepCount: model.progress.routeSteps,
        source: "journey-store-history",
      }}
    >
      <group
        ref={formationRef}
        name="constellation-formation-reveal"
        position={CONSTELLATION_FORMATION_CENTER}
        scale={reducedMotion && formationReady ? 1 : 0.02}
        visible={formationReady}
        userData={{
          formationReady,
          formationMode: reducedMotion ? "immediate" : "gradual",
          formationComplete: reducedMotion && formationReady,
          beginsAfter: "lantern-placement-or-story-completion",
        }}
      >
        {/* Compose the unaltered route in the sky without stretching its geography. */}
        <group name="constellation-sky-presentation" rotation={[0, 0, -0.5]} scale={1.55}>
          <group position={[-CONSTELLATION_FORMATION_CENTER[0], -CONSTELLATION_FORMATION_CENTER[1], -CONSTELLATION_FORMATION_CENTER[2]]}>
            <points geometry={historyGeometry}>
              <pointsMaterial
                color="#dce9f1"
                size={reducedEffects ? 0.1 : 0.135}
                transparent
                opacity={0.9}
                depthWrite={false}
                sizeAttenuation
                toneMapped={false}
              />
            </points>
            <points geometry={keystoneGeometry}>
              <pointsMaterial
                color="#dfc6a0"
                size={reducedEffects ? 0.145 : 0.18}
                transparent
                opacity={0.98}
                depthWrite={false}
                sizeAttenuation
                toneMapped={false}
              />
            </points>
            {routePoints.length > 1 ? (
              <lineSegments name="constellation-actual-walked-route" geometry={threadGeometry}>
                <lineBasicMaterial
                  color="#8ca7b7"
                  transparent
                  opacity={reducedEffects ? 0.34 : 0.46}
                  depthWrite={false}
                  toneMapped={false}
                />
              </lineSegments>
            ) : null}
          </group>
        </group>
      </group>
    </group>
  );
});

function FinalWoodlandFrame({
  qualityProfile,
  reducedEffects,
}: Pick<FinalTableauProps, "qualityProfile" | "reducedEffects">) {
  const count = reducedEffects ? 4 : Math.min(FINAL_TREE_POSITIONS.length, 5 + qualityStep(qualityProfile));
  return (
    <group name="final-woods-remain">
      <FinalWoodlandDetails positions={FINAL_TREE_POSITIONS} count={count} />
    </group>
  );
}

export const IntegratedFinalTableau = memo(function IntegratedFinalTableau({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  onFinalConstellationFormationComplete,
}: FinalTableauProps) {
  const activeEntryId = useJourneyStore((state) => state.activeEntryId);
  const history = useJourneyStore((state) => state.history);
  const witnessedEntryIds = useJourneyStore((state) => state.witnessedEntryIds);
  const completedChapterIds = useJourneyStore((state) => state.completedChapterIds);
  const completedSceneIds = useJourneyStore((state) => state.completedSceneIds);
  const completedRitualIds = useJourneyStore((state) => state.completedRitualIds);
  const resonances = useJourneyStore((state) => state.resonances);
  const releasedWords = useJourneyStore((state) => state.releasedWords);
  const landmarkStates = useJourneyStore((state) => state.landmarkStates);
  const lanternPlacedFlag = useJourneyStore((state) => state.worldFlags["lantern.placed-and-lit"] === true);
  const storyCompleted = useJourneyStore((state) => state.storyCompleted);
  const reverseComplete = useJourneyStore((state) => state.storyObjectStates["epilogue.reverse-light"] === "complete");
  const eventDriven = useJourneyStore((state) => state.worldFlags["story-events.started"] === true);
  const placementId = useJourneyStore((state) => state.storyPlacementStates["lantern.master"]);
  const lanternOffset: [number, number, number] = placementId === "reading-nook" ? [2.4, 0, .5] : placementId === "fountain" ? [-2.8, 0, 1.7] : placementId === "window" ? [3.1, 0, -1.1] : [0, 0, 0];

  const completedRitualSet = useMemo(() => new Set(completedRitualIds), [completedRitualIds]);
  const constellationModel = useMemo(
    () => buildStoryConstellationModel({
      activeEntryId,
      history,
      witnessedEntryIds,
      completedRitualIds,
      completedChapterIds,
      completedSceneIds,
      resonances,
      releasedWords,
      landmarkStates,
    }),
    [
      activeEntryId,
      completedChapterIds,
      completedRitualIds,
      completedSceneIds,
      history,
      landmarkStates,
      releasedWords,
      resonances,
      witnessedEntryIds,
    ],
  );
  const lanternPlaced = storyCompleted || lanternPlacedFlag || completedRitualSet.has("ritual.place-lantern");
  const formationReady = (lanternPlaced && (!eventDriven || reverseComplete)) || storyCompleted;

  return (
    <group
      name="integrated-final-tableau"
      userData={{
        witnessedCount: witnessedEntryIds.length,
        lanternPlaced,
        presentation: "actual-route-in-darkness",
        constellationFormation: reducedMotion ? "immediate" : "gradual",
      }}
    >
      <SceneGround radius={26} y={FINAL_GROUND_Y} color="#151919" roughness={0.98} />
      <FinalWoodlandFrame qualityProfile={qualityProfile} reducedEffects={reducedEffects} />
      <WitnessedMemoryConstellation
        model={constellationModel}
        formationReady={formationReady}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        onFormationComplete={onFinalConstellationFormationComplete}
      />

      {/* Lived places keep their full reverse reveal, then leave the sky alone. */}
      {eventDriven && !formationReady ? <ReverseMemoryLights reducedMotion={reducedMotion} /> : null}
      {lanternPlaced ? (
        <group name="placed-lit-lantern-continuity" position={lanternOffset} userData={{ placementId }}>
          {/* A grounded memory of the chosen light; the real home placement is unchanged. */}
          <LanternProp
            position={[1.18, FINAL_GROUND_Y, -6.32]}
            scale={0.78}
            reducedMotion={reducedMotion || reducedEffects}
            light={false}
            color="#ddbb85"
          />
        </group>
      ) : null}

      <LegacyChapterLight><hemisphereLight args={["#b5cad5", "#111513", reducedEffects ? 0.34 : 0.5]} /></LegacyChapterLight>
      <ChapterLightRig family="lantern-epilogue" reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
    </group>
  );
});

export default IntegratedFinalTableau;
