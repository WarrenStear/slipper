import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo } from "react";
import { SanctuaryShoreline } from "./SanctuaryShoreline";
import type { RenderQualityProfile } from "../renderQuality";
import {
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
      {/* Keep the fire-facing bank at x=-3.9 and the wash target at [0, 3].
          Only the quiet bank opens, using the same draw and unchanged floor height. */}
      <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} flow={resolved ? .18 : .38}
        position={[3.3, 0.018, 3.4]}
        size={[14.4, 15.5]}
        roughness={resolved ? .3 : .27}
        color={resolved ? "#233c40" : active ? "#162c35" : "#17292e"}
        opacity={resolved ? 0.93 : 0.86}
      />
      <group name="river-sediment-margins" position={[3.3, 0, 3.4]} scale={[.72, 1, .91]}><SanctuaryShoreline /></group>
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
