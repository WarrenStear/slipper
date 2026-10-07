import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo } from "react";
import { TimberAssembly } from "./ChapterArt";
import {
  SceneGround,
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

  return (
    <group>
      <SceneGround radius={18} color="#211f1d" />
      <WaterMemoryReflection truthful={isTruthful} reducedEffects={reducedEffects} />

      <ReflectionDirector
        sceneId={scene.id}
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
      />
      <TimberAssembly name="mirror-grounded-rear-stand" color="#7b6954" pieces={[-1, 1].flatMap(side => [
        { position: [side * 2.52, .065, 5.67] as [number, number, number], size: [.4, .13, 1.8] as [number, number, number] },
        { position: [side * 2.52, 1.4, 6.06] as [number, number, number], size: [.14, 2.95, .16] as [number, number, number], rotation: [-.32, 0, 0] as [number, number, number] },
      ])} />
      <LegacyChapterLight><directionalLight position={[10, 4, -8]} color="#ef945d" intensity={reducedEffects ? 0.48 : 0.88} /></LegacyChapterLight>

    </group>
  );
}

export const SunsetSeerChapter = memo(SunsetSeerChapterComponent);
export default SunsetSeerChapter;
