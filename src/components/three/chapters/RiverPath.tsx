import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo } from "react";
import { SanctuaryShoreline } from "./SanctuaryShoreline";
import type { RenderQualityProfile } from "../renderQuality";
import {
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

function RiverPathComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  active,
  resolved,
  actorsEnabled = true,
}: RiverPathProps) {

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
      <group name="river-sediment-margins" position={[0, 0, 3.4]} scale={[.39, 1, .91]}><SanctuaryShoreline /></group>
      <MoonDisc
        position={[2.9, 8.8, -7.8]}
        radius={active ? 2.55 : 2.15}
        color={resolved ? "#e4edef" : "#cfdee7"}
        intensity={active ? 1.8 : 1.25}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
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
