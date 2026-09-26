import { memo, useCallback } from "react";
import { DoubleSide, FrontSide, type MeshStandardMaterial } from "three";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { applyTactileShader } from "../storyEvents/tactileShader";
import { applyFoliageFinish } from "./foliageFinish";

/** Shared opaque leaf finish. No alpha sorting, shadow pass, or texture allocation. */
export const FoliageMaterial = memo(function FoliageMaterial({ color, vertexColors = false, doubleSided = false }: {
  color: string; vertexColors?: boolean; doubleSided?: boolean;
}) {
  const detail = useTactileDetail();
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, "moss", detail);
    applyFoliageFinish(shader, detail === "relief");
  }, [detail]);
  const key = useCallback(() => `sidtw-foliage-v1-${detail}`, [detail]);
  return <meshStandardMaterial key={key()} color={color} vertexColors={vertexColors} roughness={.92} metalness={0}
    side={doubleSided ? DoubleSide : FrontSide} onBeforeCompile={compile} customProgramCacheKey={key} />;
});
