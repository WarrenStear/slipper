import { memo, useCallback } from "react";
import type { MeshStandardMaterial } from "three";
import { useWoodlandSurfaceTexture } from "../../../world/forest/useForestTextures";
import { applyTactileShader } from "../storyEvents/tactileShader";
import { useTactileDetail } from "../storyEvents/TactileMaterial";

/** Shared generated albedo; fine relief is an artistic approximation, not a scan. */
export const WoodlandSurfaceMaterial = memo(function WoodlandSurfaceMaterial({ surface, vertexColors = true }: { surface: "stone" | "soil"; vertexColors?: boolean }) {
  const map = useWoodlandSurfaceTexture(surface), detail = useTactileDetail();
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, surface === "soil" ? "earth" : "stone", detail);
  }, [surface, detail]);
  return <meshStandardMaterial map={map} bumpMap={detail === "relief" ? map : null} bumpScale={surface === "soil" ? .035 : .045}
    color="#ffffff" vertexColors={vertexColors} roughness={surface === "soil" ? .94 : .88} onBeforeCompile={compile}
    customProgramCacheKey={() => `woodland-surface-${surface}-${detail}-v1`} />;
});
