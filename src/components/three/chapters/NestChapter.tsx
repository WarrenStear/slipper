import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo, useEffect, useMemo } from "react";
import { createTaperedBranchGeometry, mergeArtGeometries } from "../environmentArt/authoredGeometry";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import {
  CandleField,
  FlickerLight,
  HouseShell,
  KeyProp,
  SceneGround,
  qualityStep,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

import type { ConstructionPiece } from "./chapterArtGeometry";
import { RestingThrow, TimberAssembly } from "./ChapterArt";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { nestDomesticLayout, nestSpatialPressure } from "./domesticSpatialPressure";

type NestState = "repairing" | "burdened" | "protected";

function WovenNest({
  state,
  detail,
  reducedEffects,
}: {
  state: NestState;
  detail: number;
  reducedEffects: boolean;
}) {
  const weave = useMemo(() => {
    const pieces = [];
    const arcs = reducedEffects ? 8 : 10 + Math.min(detail, 2) * 2;
    // Three overlapping courses rest on shallow radial ribs. The open centre
    // stays available for the existing linen and responsibility interaction.
    for (let course = 0; course < 3; course++) for (let i = 0; i < arcs; i++) {
      const start = i / arcs * Math.PI * 2 + course * .19;
      const radius = 1.82 + course * .16;
      const points = Array.from({ length: 5 }, (_, j) => {
        const angle = start + j * .25;
        return [Math.cos(angle) * radius, .17 + course * .23 + Math.sin(angle * 5 + course) * .035, Math.sin(angle) * radius * .65] as [number, number, number];
      });
      pieces.push(createTaperedBranchGeometry(points, .057 - course * .006, i + course * 17, 5, 8));
    }
    for (let i = 0; i < arcs; i++) {
      const angle = i / arcs * Math.PI * 2;
      pieces.push(createTaperedBranchGeometry([
        [Math.cos(angle) * 1.53, .04, Math.sin(angle) * .99],
        [Math.cos(angle) * 1.9, .26, Math.sin(angle) * 1.23],
        [Math.cos(angle) * 2.2, .73, Math.sin(angle) * 1.43],
      ], .046, i + 53, 5, 8));
    }
    return mergeArtGeometries(pieces);
  }, [detail, reducedEffects]);
  useEffect(() => () => weave.dispose(), [weave]);
  return <group name="nest-stable-shelter" position={[0, 0, 2.5]}>
    <mesh name="interlaced-grounded-willow" geometry={weave} castShadow receiveShadow>
      <TactileMaterial surface="bark" color={state === "protected" ? "#a08a65" : "#877252"} roughness={.97} />
    </mesh>
  </group>;
}

/** Two joined supports take the weight at opposite edges of the same fragile centre. */
function SupportingTrestle({ side, balanced }: { side: -1 | 1; balanced: boolean }) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    { position: [0, .56, 0], size: [.32, .16, 1.8] },
    ...[-1, 1].map(end => ({ position: [side * .14, .27, end * .64] as [number, number, number], size: [.16, .54, .2] as [number, number, number], rotation: [0, 0, side * -.18] as [number, number, number] })),
    { position: [-side * .38, .63, 0], size: [1.12, .1, 1.24], rotation: [0, 0, side * (balanced ? .025 : .08)] },
    { position: [side * .16, .21, 0], size: [.12, .12, 1.48] },
  ], [side, balanced]);
  return <group name={`nest-shared-support:${side}`} position={[side * 2.65, 0, 2.5]}>
    <TimberAssembly pieces={pieces} color={side < 0 ? "#826447" : "#927251"} />
    <RestingThrow position={[-side * .33, .7, 0]} size={[1.05, 1.8]} maxDrop={.22} color="#c3b298" />
  </group>;
}

function TwoHandRepair({ balanced }: { balanced: boolean }) {
  return <group name="nest-two-supports-one-centre" userData={{ balanced }}>
    <SupportingTrestle side={-1} balanced={balanced} />
    <SupportingTrestle side={1} balanced={balanced} />
  </group>;
}

/** Familiar laundry and furniture occupy the edges; nothing hangs over the linen. */
function UnsupportedWeight({ pressure, reducedEffects }: { pressure: number; reducedEffects: boolean }) {
  const forms = useMemo(() => nestDomesticLayout(pressure, reducedEffects), [pressure, reducedEffects]);
  const { layers, sideX } = forms;
  return <group name="nest-occupied-domestic-edges" userData={{ pressure }}>
    <TimberAssembly pieces={forms.timber} color="#715940" />
    <TimberAssembly pieces={forms.linen} color="#8c816c" surface="linen" />
    {[-1, 1].map(side => <RestingThrow key={side}
      position={[side * sideX, .99 + (layers - 1) * .16, side < 0 ? -.7 : .05]}
      size={[1.08, 1.05]} maxDrop={.42} color={side < 0 ? "#948775" : "#887e6c"} />)}
  </group>;
}

/** A roof with open sides keeps the resting linen safe without marking a zone. */
function ProtectionShelter({ detail }: { detail: number }) {
  const pieces = useMemo<ConstructionPiece[]>(() => [
    ...[-1, 1].flatMap(side => [1.05, 3.95].map(z => ({ position: [side * 2.78, 1.67, z] as [number, number, number], size: [.12, 3.34, .14] as [number, number, number] }))),
    ...[1.05, 3.95].map(z => ({ position: [0, 3.37, z] as [number, number, number], size: [5.7, .14, .16] as [number, number, number] })),
    ...Array.from({ length: 3 + Math.min(detail, 2) }, (_, i) => ({ position: [-2.6 + i * 5.2 / (2 + Math.min(detail, 2)), 3.47, 2.5] as [number, number, number], size: [.08, .1, 3.05] as [number, number, number] })),
  ], [detail]);
  return <group name="nest-open-linen-shelter">
    <TimberAssembly pieces={pieces} color="#917958" />
    <RestingThrow position={[0, 3.55, 2.5]} size={[5.8, 4.9]} maxDrop={.32} color="#c8b99b" />
  </group>;
}

function NestChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const state: NestState = scene.id === "nest.unsupported-cycle"
    ? "burdened"
    : scene.id === "nest.protection"
      ? "protected"
      : "repairing";
  const presentation = useSceneLook();
  const detail = qualityStep(qualityProfile);
  const isCycle = state === "burdened";
  const isProtection = state === "protected";
  const twoHandsBalanced = useJourneyStore(
    (journey) => journey.worldFlags["nest.hand-held"] === true && journey.worldFlags["nest.hand-kept"] === true,
  );
  const burdenReleased = useJourneyStore(
    (journey) => journey.worldFlags["nest.unsupported-burden-released"] === true,
  );
  const daysCompressed = useJourneyStore(journey => journey.storyObjectStates["nest.day"] === "compressed" || journey.worldFlags["nest.unsupported-burden-held"] === true);
  const responsibilityResting = useJourneyStore(journey => journey.storyObjectStates["nest.responsibility"] === "placed");
  const pressure = nestSpatialPressure(scene.id, daysCompressed, burdenReleased || responsibilityResting);
  const protectionAcknowledged = useJourneyStore(
    (journey) => journey.worldFlags["nest.protection-acknowledged"] === true,
  );

  return (
    <group>
      <SceneGround radius={16} color="#282e29" />


      <group name="nest-unwavering-domestic-shelter">
        <HouseShell
          position={[0, 0, 3]}
          size={[9.5, isProtection ? 5 : 4.6, 6.8]}
          wallColor="#56564a"
          roofColor={isProtection ? "#343b35" : "#2a302d"}
        />
      </group>

      <WovenNest
        state={state}
        detail={detail}
        reducedEffects={reducedEffects}
      />
      {state === "repairing" ? <TwoHandRepair balanced={twoHandsBalanced} /> : null}
      <UnsupportedWeight pressure={pressure} reducedEffects={reducedEffects} />
      {isProtection ? <ProtectionShelter detail={reducedEffects ? 0 : detail} /> : null}

      {isProtection ? (
        <KeyProp
          position={[0, protectionAcknowledged ? 1.62 : 1.42, 2.3]}
          scale={protectionAcknowledged ? 1.34 : 1.2}
          color={protectionAcknowledged ? "#c6b28a" : "#a88e63"}
        />
      ) : null}
      <group name="nest-quiet-practical-light" position={[-1, 0, 3.5]}><CandleField
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        count={isProtection ? 3 : isCycle ? 1 : 2}
        radius={1.8}
        color="#e8c99a"
        y={0.04}
      /></group>
      <FlickerLight
        position={[-1, 2.5, 3.5]}
        color={presentation?.look.lighting.color ?? "#e3d0ac"}
        intensity={1.7}
        distance={7.5}
        reducedMotion={reducedMotion}
      />
      <LegacyChapterLight><directionalLight
        position={[8, 11, -7]}
        color={isCycle ? "#b9aaa0" : "#ffd89f"}
        intensity={reducedEffects ? 0.42 : isProtection ? 1.02 : 0.86}
      /></LegacyChapterLight>
    </group>
  );
}

export const NestChapter = memo(NestChapterComponent);
export default NestChapter;
