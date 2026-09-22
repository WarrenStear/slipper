import { memo, useMemo } from "react";
import { BotanicalBatch } from "../environmentArt/EnvironmentArt";
import { Forms } from "./EnvironmentDressing";
import { finalWoodlandForms, meadowFlowerForms } from "./woodlandSceneLayout";
import type { Point3 } from "./chapterEnvironment";

export const MeadowFlowers = memo(function MeadowFlowers({ reducedEffects }: { reducedEffects: boolean }) {
  const forms = useMemo(() => meadowFlowerForms(reducedEffects), [reducedEffects]);
  const placements = useMemo(() => forms.flowers.map((flower, index) => ({
    position: [flower.position[0], flower.position[1] - .435, flower.position[2]] as Point3,
    rotation: [0, index * 2.4, 0] as Point3,
    color: flower.color,
  })), [forms]);
  return <group name="meadow-flower-batches" userData={{ decorativeOnly: true, drawCallBudget: 2 }}>
    <BotanicalBatch kind="rose" name="meadow" mergeFoliage seed={51} placements={placements} color="#ffffff" />
  </group>;
});

export const FinalWoodlandDetails = memo(function FinalWoodlandDetails({ positions, count }: { positions: readonly Point3[]; count: number }) {
  const forms = useMemo(() => finalWoodlandForms(positions, count), [positions, count]);
  return <group name="final-woodland-batches" userData={{ decorativeOnly: true, drawCallBudget: 3 }}>
    <Forms forms={forms.trunks} name="final-tree-trunks" color="#28221d" kind="tree" surface="bark" roughness={1} shadows />
    <Forms forms={forms.crowns} name="final-tree-canopies" color="#ffffff" kind="crown" />
    <Forms forms={forms.roots} name="final-tree-roots" color="#3a4034" kind="stone" surface="bark" />
  </group>;
});
