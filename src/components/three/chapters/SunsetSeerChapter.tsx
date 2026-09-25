import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo } from "react";
import {
  FabricVeil,
  FloatingMotes,
  SceneGround,
  StonePath,
  TreeGrove,
} from "./ChapterPrimitives";
import { ReflectionDirector } from "../reflections/ReflectionDirector";
import { WaterMemoryReflection } from "../reflections/WaterMemoryReflection";
import type { ChapterSceneProps } from "./types";

function SunsetSeerChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isTruthful = scene.id === "sunset.true-mirror";
  const isStillness = scene.id === "sunset.stillness";

  return (
    <group>
      <SceneGround radius={18} color="#211f1d" />
      <TreeGrove qualityProfile={qualityProfile} reducedEffects={reducedEffects} tint="#31352f" trunk="#2b211c" radius={18} />
      <WaterMemoryReflection truthful={isTruthful} reducedEffects={reducedEffects} />
      <StonePath color="#5d574f" count={9} length={14} y={0.06} />

      <ReflectionDirector
        sceneId={scene.id}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
      <FabricVeil
          position={[-5.2, 3.1, -1.2]}
          rotation={[0, 0.2, 0]}
          size={[1.7, 4.9]}
          color="#c4b8ab"
          opacity={0.38}
          reducedMotion={reducedMotion}
      />
      <FloatingMotes
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects || isStillness}
        reducedMotion={reducedMotion}
        color="#e49a64"
        radius={10}
        height={6}
      />
      <LegacyChapterLight><directionalLight position={[10, 4, -8]} color="#ef945d" intensity={reducedEffects ? 0.48 : 0.88} /></LegacyChapterLight>

    </group>
  );
}

export const SunsetSeerChapter = memo(SunsetSeerChapterComponent);
export default SunsetSeerChapter;
