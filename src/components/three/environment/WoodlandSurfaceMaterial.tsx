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
    if (surface === "stone") {
      shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `#include <color_fragment>
        float mineralVein=1.-smoothstep(.025,.11,abs(sin(vStoryPosition.y*5.8+vStoryPosition.x*1.7+storyNoise(vStoryPosition*2.8)*2.)));
        float lichen=smoothstep(.59,.77,storyNoise(vStoryPosition*7.3))*smoothstep(.05,.65,vStoryNormal.y);
        diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(1.19,1.17,1.11),mineralVein*.46);
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.22,.12),lichen*.32);
      `).replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor=clamp(roughnessFactor+(lichen-.3)*.12,.67,.98);
      `);
    }
  }, [surface, detail]);
  return <meshStandardMaterial map={map} bumpMap={detail === "relief" ? map : null} bumpScale={surface === "soil" ? .035 : .045}
    color="#ffffff" vertexColors={vertexColors} roughness={surface === "soil" ? .94 : .88} onBeforeCompile={compile}
    customProgramCacheKey={() => `woodland-surface-${surface}-${detail}-v2`} />;
});
