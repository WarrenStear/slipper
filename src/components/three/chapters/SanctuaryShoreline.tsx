import { memo, useEffect, useMemo } from "react";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { createSanctuaryShorelineGeometry } from "./sanctuaryShorelineGeometry";

/** One opaque batch; existing habitat supplies the reeds, roots and stones. */
export const SanctuaryShoreline = memo(function SanctuaryShoreline() {
  const geometry = useMemo(createSanctuaryShorelineGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh name="sanctuary-sediment-waterline" geometry={geometry} receiveShadow>
    <TactileMaterial surface="earth" color="#ffffff" vertexColors roughness={.91} />
  </mesh>;
});
