import { LegacyChapterLight } from "../artDirection/LegacyChapterLight";
import { memo } from "react";
import {
  CandleField,
  FabricVeil,
  FloatingMotes,
  LanternProp,
  SceneGround,
  StonePath,
  WaterSurface,
} from "./ChapterPrimitives";
import { ForestDepth } from "../environment/EnvironmentDressing";
import { MeadowFlowers } from "../environment/WoodlandDetails";
import { ChapterLightRig } from "../environment/ChapterLightRig";
import type { ChapterSceneProps } from "./types";

function EnchantedWoodChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isRabbitHole = scene.id === "enchanted.rabbit-hole";
  const isMeadow = scene.id === "enchanted.friendship-meadow";

  return (
    <group>
      <SceneGround radius={16} color="#23251b" />
      <ForestDepth quality={qualityProfile.quality} reducedEffects={reducedEffects} variant="enchanted-wood" />
      <StonePath color="#716756" count={11} length={18} />
      <FloatingMotes
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        color="#d6b66d"
        radius={9}
      />

      {isRabbitHole ? (
        <group position={[0, 0.2, 2.8]} rotation={[Math.PI / 2, 0, 0]}>
          {[1, 1.35, 1.7].map((scale) => (
            <mesh key={scale} scale={scale}>
              <torusGeometry args={[2.15, 0.18, 8, 32, Math.PI * 1.62]} />
              <meshStandardMaterial color="#44362a" roughness={1} />
            </mesh>
          ))}
        </group>
      ) : null}

      {isMeadow ? (
        <>
          <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} position={[-4.8, 0.02, 1.4]} size={[5.5, 5.5]} color="#263d43" opacity={0.82} circle />
          <MeadowFlowers reducedEffects={reducedEffects} />
        </>
      ) : (
        <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={10} radius={4.8} />
      )}

      {!isRabbitHole ? (
        <FabricVeil
          position={[-4.7, 3.2, -1]}
          rotation={[0, 0.24, 0]}
          size={[1.8, 4.7]}
          color="#d2c9b5"
          opacity={0.58}
          reducedMotion={reducedMotion}
        />
      ) : null}
      <LanternProp position={[0.4, 0.15, 7.6]} scale={0.78} reducedMotion={reducedMotion} />
      <ChapterLightRig family="enchanted-wood" reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
      <LegacyChapterLight><hemisphereLight args={["#b6c3ad", "#15160f", reducedEffects ? 0.18 : 0.34]} /></LegacyChapterLight>
    </group>
  );
}

export const EnchantedWoodChapter = memo(EnchantedWoodChapterComponent);
export default EnchantedWoodChapter;
