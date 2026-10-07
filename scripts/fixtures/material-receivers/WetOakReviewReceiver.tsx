import { useEffect, useMemo } from "react";
import { TactileMaterial, TactileDetailProvider } from "./src/components/three/storyEvents/TactileMaterial";
import { createConstructionGeometry, type ConstructionPiece } from "./src/components/three/chapters/chapterArtGeometry";
import type { MaterialMemory } from "./src/components/three/materials/materialLibrary";

/** External review receiver. Automatic delivery is exercised; maps are never borrowed. */
export function WetOakReviewReceiver({ quality, reducedEffects, surface, memory = {} }: {
  quality: "low" | "medium" | "high" | "cinematic";
  reducedEffects: boolean;
  surface: "wood" | "wet-wood";
  memory?: MaterialMemory;
}) {
  // The same production constructor supplies long side grain and separate cut caps.
  // Three orthogonal construction axes show stretching/end-grain errors explicitly.
  const geometry = useMemo(() => createConstructionGeometry([
    { position: [0, -.25, 0], size: [2.7, .14, .38] },
    { position: [-.78, .55, .02], size: [.25, 1.9, .18] },
    { position: [.65, -.25, .45], size: [.21, .12, 2.2] },
  ] satisfies ConstructionPiece[]), []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <TactileDetailProvider quality={quality} reducedEffects={reducedEffects}>
    <mesh name="review-actual-construction-oak" geometry={geometry} castShadow receiveShadow
      userData={{ reviewOnly: true, receiver: "production-construction-geometry", surface }}>
      <TactileMaterial surface={surface} color="#846c51" roughness={.86}
        constructionCoordinates vertexColors memory={memory} />
    </mesh>
  </TactileDetailProvider>;
}
