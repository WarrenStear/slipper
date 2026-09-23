import { Forms } from "../environment/EnvironmentDressing";
import { BotanicalBatch } from "../environmentArt/EnvironmentArt";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";
import { memo } from "react";
import {
  CandleField,
  MoonDisc,
  ReflectivePanel,
  SceneGround,
  StonePath,
  TreeGrove,
  WaterSurface,
} from "./ChapterPrimitives";
import type { ChapterSceneProps } from "./types";
import { useJourneyStore } from "../../../stores/useJourneyStore";

function WolfStone({ witnessed }: { witnessed: boolean }) {
  return <group name="integration-wolf" position={[-5.4, .2, 1.8]} rotation={[0, .45, 0]} userData={{ witnessed }}>
    <group rotation={[0, Math.PI / 2, 0]} scale={1.4}><AuthoredNpcSilhouette kind="wolf" /></group>
  </group>;
}
function SwanStone({ witnessed }: { witnessed: boolean }) {
  return <group name="integration-swan" position={[5.2, .15, 1.6]} userData={{ witnessed }}>
    <group rotation={[0, Math.PI / 2, 0]} scale={1.6}><AuthoredNpcSilhouette kind="swan" /></group>
  </group>;
}

function IntegrationChapterComponent({
  scene,
  qualityProfile,
  reducedEffects,
  reducedMotion,
}: ChapterSceneProps) {
  const isConvergenceScene = scene.id === "wolf-swan.convergence";
  const storyActorsActive = useJourneyStore(journey => journey.worldFlags["story-events.started"] === true);
  const swanWitnessed = useJourneyStore((journey) => journey.worldFlags["integration.swan-witnessed"] === true);
  const wolfWitnessed = useJourneyStore((journey) => journey.worldFlags["integration.wolf-witnessed"] === true);
  const seerWitnessed = useJourneyStore((journey) => journey.worldFlags["integration.seer-witnessed"] === true);
  const converged = useJourneyStore((journey) => journey.worldFlags["integration.three-aspects-held"] === true);
  return (
    <group name="wolf-swan-seer-integration" userData={{ swanWitnessed, wolfWitnessed, seerWitnessed, integrated: converged }}>
      <SceneGround radius={20} color="#26231d" />
      <TreeGrove qualityProfile={qualityProfile} reducedEffects={reducedEffects} tint="#323c32" radius={27} />
      <WaterSurface reducedMotion={reducedMotion} reducedEffects={reducedEffects} position={[6, 0.015, 1]} size={[8.5, 10]} color="#20343e" opacity={0.82} circle />
      <group name="integration-moon">
        <MoonDisc
          position={[8, 9, -12]}
          radius={2.5}
          qualityProfile={qualityProfile}
          reducedEffects={reducedEffects}
          reducedMotion={reducedMotion}
        />
      </group>
      <group position={[-6, 0, 0]}>
        <StonePath color="#5d4a37" count={7} length={11} fork={-0.42} />
        <CandleField qualityProfile={qualityProfile} reducedEffects={reducedEffects} count={8} radius={3.2} color="#db824c" />
      </group>
      <group position={[6, 0, 0]}>
        <StonePath color="#747a78" count={7} length={11} fork={0.42} />
      </group>
      <group name="seer-high-ground" position={[0, 0, 0]}>
        <ReflectivePanel position={[0, 3.2, 6.1]} size={[4.5, 5.8]} cracked />

      </group>
      {storyActorsActive ? null : <WolfStone witnessed={wolfWitnessed} />}
      {storyActorsActive ? null : <SwanStone witnessed={swanWitnessed} />}
      {isConvergenceScene ? (
        <group>
          <group name="integration-shared-shoreline">
            <Forms name="wood-water-stone-passage" kind="stone" surface="stone" color="#64736a" forms={Array.from({ length: 15 }, (_, i) => ({ position: [-8 + i * 1.12, .04, 3.2 + Math.sin(i * .45) * 1.4], scale: [.9, .11, .65], rotation: [0, i * 1.7, 0] }))} />
            <BotanicalBatch kind="reeds" mergeFoliage placements={Array.from({ length: 10 }, (_, i) => ({ position: [-6 + i * 1.35, .02, 5.3 + Math.sin(i * .8)], scale: .8, rotation: [0, i, 0] }))} />
          </group>
          {["swan", "wolf", "seer"].map((symbol, index) => {
            const x = -2.2 + index * 2.2;
            return (
              <mesh key={symbol} name={`integrated-${symbol}-node`} position={[x, .08, 3.6]} scale={[1, .14, .7]} userData={{ integrated: converged }} receiveShadow>
                <icosahedronGeometry args={[.8, 1]} />
                <meshStandardMaterial color={converged ? "#818a77" : "#5c675d"} roughness={.92} />
              </mesh>
            );
          })}
        </group>
      ) : (
        <mesh position={[0, 0.25, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.2, 2.8, 48, 1, 0.25, Math.PI * 1.5]} />
          <meshStandardMaterial color="#51483e" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

export const IntegrationChapter = memo(IntegrationChapterComponent);
export default IntegrationChapter;
