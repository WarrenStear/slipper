import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo } from "react";
import type { RenderQualityProfile } from "../renderQuality";
import {
  Beam,
  BirdSwarm,
  FabricVeil,
  StonePath,
} from "./ChapterPrimitives";

type SurrenderClearingProps = {
  actorsEnabled?: boolean;
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  active: boolean;
  resolved: boolean;
};

function RestingWolf() { return <group name="surrendered-wolf" position={[-2.35, .2, 1.4]} rotation={[0, .52, 0]} scale={[1.1, .76, 1.1]}><group rotation={[0, Math.PI / 2, 0]} scale={1.4}><AuthoredNpcSilhouette kind="wolf" resting /></group></group>; }

function SurrenderClearingComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  active,
  resolved,
  actorsEnabled = true,
}: SurrenderClearingProps) {
  const birdCount = reducedEffects ? 7 : qualityProfile.quality === "low" ? 12 : 20;
  const awake = active || resolved;

  return (
    <group
      name="surrender-clearing"
      position={[0, 0, 8.4]}
      userData={{ storyRoute: "surrender", ritual: "release-and-surrender", active, resolved }}
    >
      <group position={[0, 0, -5.2]}>
        <StonePath color={awake ? "#8e887c" : "#514c45"} count={7} length={10.5} />
      </group>
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <circleGeometry args={[4.6, 40]} />
        <meshStandardMaterial color={awake ? "#46453f" : "#2c2925"} roughness={1} />
      </mesh>
      <mesh position={[0, 0.045, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.35, 3.46, 48]} />
        <meshBasicMaterial color={awake ? "#d9d6cb" : "#615e57"} transparent opacity={awake ? 0.58 : 0.22} />
      </mesh>

      {actorsEnabled ? <group position={[0, awake ? 3.6 : 3.15, -0.2]} scale={awake ? 1 : 0.78}>
        <Beam from={[-1.95, -3.35, 0]} to={[-1.95, 2.05, 0]} radius={0.055} color="#80786a" />
        <FabricVeil
          position={[-0.25, 0.6, 0]}
          rotation={[0, -0.08, 0.02]}
          size={awake ? [3.5, 4.25] : [2.7, 2.4]}
          color="#eeeae0"
          opacity={awake ? 0.86 : 0.18}
          reducedMotion={reducedMotion || !awake}
          phase={0.8}
        />
      </group> : null}

      {actorsEnabled ? <group position={awake ? [0, 3.4, -1.8] : [0, 0, -1.8]}>
        <BirdSwarm count={birdCount} dispersed={awake} color="#0c0e10" />
      </group> : null}
      {awake && actorsEnabled ? <RestingWolf /> : null}
      <LegacyChapterLight><pointLight
        position={[0, 3.2, 0.8]}
        color="#e5dfd2"
        intensity={awake ? 0.78 : 0.16}
        distance={awake ? 18 : 9}
        decay={2}
      /></LegacyChapterLight>
    </group>
  );
}

export const SurrenderClearing = memo(SurrenderClearingComponent);
export default SurrenderClearing;
