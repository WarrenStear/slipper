import { memo } from "react";
import {
  Beam,
  FabricVeil,
  FloatingMotes,
  ReflectivePanel,
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
  const isWarning = scene.id === "sunset.warning-grove";
  const isTruthful = scene.id === "sunset.true-mirror";
  const isStillness = scene.id === "sunset.stillness";
  const sideMirrorCount = reducedEffects ? 1 : qualityProfile.quality === "low" ? 2 : 4;

  return (
    <group>
      <SceneGround radius={18} color="#211f1d" />
      <TreeGrove qualityProfile={qualityProfile} reducedEffects={reducedEffects} tint="#31352f" trunk="#2b211c" radius={18} />
      <WaterMemoryReflection truthful={isTruthful} still={isStillness} reducedEffects={reducedEffects} />
      <StonePath color="#5d574f" count={9} length={14} y={0.06} />

      <ReflectionDirector
        sceneId={scene.id}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
      {Array.from({ length: sideMirrorCount }, (_, index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        return (
          <ReflectivePanel
            key={index}
            position={[side * (6.2 + row * 1.4), 2.2 + row * 0.25, 0.7 - row * 3.1]}
            rotation={[0, side * -0.34, 0]}
            size={[2.1, 4.1]}
            warm={isWarning}
          />
        );
      })}

      {!isStillness ? (
        <FabricVeil
          position={[-5.2, 3.1, -1.2]}
          rotation={[0, 0.2, 0]}
          size={[1.7, 4.9]}
          color="#c4b8ab"
          opacity={0.38}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <FloatingMotes
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects || isStillness}
        reducedMotion={reducedMotion}
        color="#e49a64"
        radius={10}
        height={6}
      />
      <Beam from={[-9, 0.18, -4]} to={[9, 0.18, -4]} radius={0.025} color="#d88b5a" opacity={0.48} />
      <directionalLight position={[10, 4, -8]} color="#ef945d" intensity={reducedEffects ? 0.48 : 0.88} />
      <pointLight position={[0, 4, 4]} color="#9fb7cd" intensity={isStillness ? 1.05 : 0.6} distance={19} />
    </group>
  );
}

export const SunsetSeerChapter = memo(SunsetSeerChapterComponent);
export default SunsetSeerChapter;
