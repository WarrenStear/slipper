import { memo, useMemo } from "react";
import { Forms } from "./EnvironmentDressing";
import { finalWoodlandForms, meadowFlowerForms } from "./woodlandSceneLayout";
import type { Point3 } from "./chapterEnvironment";

export const MeadowFlowers = memo(function MeadowFlowers({ reducedEffects }: { reducedEffects: boolean }) {
  const forms = useMemo(() => meadowFlowerForms(reducedEffects), [reducedEffects]);
  return <group name="meadow-flower-batches" userData={{ decorativeOnly: true, drawCallBudget: 2 }}>
    <Forms forms={forms.stems} name="meadow-stems" color="#465b3f" kind="stem" roughness={1} />
    <Forms forms={forms.flowers} name="meadow-blossoms" color="#ffffff" kind="flower" roughness={.86} />
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
