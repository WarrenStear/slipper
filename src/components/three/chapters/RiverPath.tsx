import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo } from "react";
import type { RenderQualityProfile } from "../renderQuality";
import {
  FabricVeil,
  MoonDisc,
  StonePath,
  WaterSurface,
} from "./ChapterPrimitives";

type RiverPathProps = {
  actorsEnabled?: boolean;
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  active: boolean;
  resolved: boolean;
};

function SwanGuardian() { return <group name="river-swan-guardian" position={[2.45, .18, 4.8]} rotation={[0, -.5, 0]}><group rotation={[0, Math.PI / 2, 0]} scale={1.55}><AuthoredNpcSilhouette kind="swan" /></group></group>; }

function RiverRipples({ active, resolved }: Pick<RiverPathProps, "active" | "resolved">) {
  const colors = active
    ? ["#9fc6d5", "#719aaa", "#4f7282"]
    : resolved
      ? ["#b7d0d5", "#79969d", "#58727a"]
      : ["#4f6f7f", "#3f5c6c", "#334c5a"];

  return (
    <group position={[0, 0.055, 3.4]}>
      {colors.map((color, index) => (
        <mesh key={color} rotation={[-Math.PI / 2, 0, 0]} scale={[1, 0.58, 1]}>
          <ringGeometry args={[1.1 + index * 0.82, 1.16 + index * 0.82, 48]} />
          <meshBasicMaterial color={color} transparent opacity={active ? 0.54 - index * 0.1 : 0.3} depthWrite={false} />
        </mesh>
      ))}
    </group>
  );
}

function RiverPathComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  active,
  resolved,
  actorsEnabled = true,
}: RiverPathProps) {
  const showSecondVeil = !reducedEffects && qualityProfile.quality !== "low";

  // The active wash happens at scene-local [0, 3]. Keep its visible
  // current under that authored input/ripple target; the old offset is
  // only the distant river branch in the other Fire/River scenes.
  return (
    <group
      name="river-path"
      position={active ? [0, 0, -0.4] : [5.8, 0, 0.8]}
      rotation={[0, active ? 0 : 0.36, 0]}
      userData={{ storyRoute: "river", ritual: "wash-what-still-aches", active, resolved }}
    >
      <StonePath color={active ? "#8a9698" : "#647075"} count={10} length={17} fork={0.28} y={0.055} />
      <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} flow={.65}
        position={[0, 0.018, 3.4]}
        size={[7.8, 15.5]}
        color={resolved ? "#294a57" : active ? "#1d4458" : "#193441"}
        opacity={resolved ? 0.93 : 0.86}
      />
      <RiverRipples active={active} resolved={resolved} />
      <MoonDisc
        position={[2.9, 8.8, -7.8]}
        radius={active ? 2.55 : 2.15}
        color={resolved ? "#e4edef" : "#cfdee7"}
        intensity={active ? 1.8 : 1.25}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
      <FabricVeil
        position={[2.85, 2.65, 2.25]}
        rotation={[0, -0.24, 0.02]}
        size={[1.55, 4.7]}
        color={resolved ? "#edf0eb" : "#cbd6d8"}
        opacity={active ? 0.76 : 0.48}
        reducedMotion={reducedMotion}
      />
      {showSecondVeil ? (
        <FabricVeil
          position={[-2.65, 2.15, 5.25]}
          rotation={[0, 0.3, -0.03]}
          size={[1.2, 3.8]}
          color="#b7c9cf"
          opacity={active ? 0.55 : 0.3}
          reducedMotion={reducedMotion}
          phase={1.7}
        />
      ) : null}
      {actorsEnabled ? <SwanGuardian /> : null}
      <LegacyChapterLight><pointLight
        position={[0, 2.4, 3.2]}
        color={resolved ? "#c5e0e4" : "#7eaec4"}
        intensity={active ? 1.35 : 0.58}
        distance={active ? 20 : 14}
        decay={2}
      /></LegacyChapterLight>
    </group>
  );
}

export const RiverPath = memo(RiverPathComponent);
export default RiverPath;
