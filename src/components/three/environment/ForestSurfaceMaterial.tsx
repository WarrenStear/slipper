import { applyFoliageFinish } from "./foliageFinish";
import { memo, useCallback } from "react";
import { DoubleSide, FrontSide, type ColorRepresentation, type Texture, type MeshStandardMaterial } from "three";
import { applyTactileShader, tactileDetailFor } from "../storyEvents/tactileShader";
import type { RenderQualityProfile } from "../renderQuality";

type ForestFinish = "bark" | "canopy" | "ground";
type Props = {
  finish: ForestFinish;
  qualityProfile: RenderQualityProfile;
  map?: Texture | null;
  color?: ColorRepresentation;
  vertexColors?: boolean;
  emissive?: ColorRepresentation;
  emissiveIntensity?: number;
};

/** Forest finishes extend the shared standard-light shader, with no texture/RT allocation. */
export const ForestSurfaceMaterial = memo(function ForestSurfaceMaterial({ finish, qualityProfile, ...appearance }: Props) {
  const detail = tactileDetailFor(qualityProfile.quality, qualityProfile.particleMultiplier <= 0);
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, finish === "bark" ? "bark" : "earth", detail);
    if (finish === "ground") {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", "#include <common>\nattribute vec4 terrainHabitat; varying vec4 vTerrainHabitat;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvTerrainHabitat = terrainHabitat;");
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec4 vTerrainHabitat;")
        .replace("#include <color_fragment>", `#include <color_fragment>
          // Canonical worker masks contain route compression and biome moisture.
          // World metres break the albedo repeat without displacing its surface.
          float soilMacro = storyNoise(vStoryPosition * .16);
          float leafBreakup = storyNoise(vStoryPosition * 1.2);
          float damp = clamp(vTerrainHabitat.y * (.56 + soilMacro * .55), 0., 1.);
          float moss = vTerrainHabitat.z * smoothstep(.3, .76, soilMacro) * (1. - vTerrainHabitat.x * .78);
          float litter = smoothstep(.57, .78, leafBreakup) * (1. - moss) * (1. - vTerrainHabitat.x * .64);
          diffuseColor.rgb *= mix(vec3(.68, .67, .59), vec3(1.05, 1.04, .93), soilMacro);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.59, .72, .48), moss * .55);
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.14, .98, .75), litter * .3);
          diffuseColor.rgb *= 1. - damp * .16;
          diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(.82, .78, .75), vTerrainHabitat.w * .45);
        `)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
          roughnessFactor = clamp(roughnessFactor - damp * .3 - vTerrainHabitat.x * .07 + moss * .13 + litter * .06, .46, .99);
        `);
    } else if (finish === "canopy") {
      applyFoliageFinish(shader, detail === "relief");
    }
  }, [detail, finish]);
  const programKey = useCallback(() => `sidtw-forest-${finish}-${detail}-v2`, [detail, finish]);
  return <meshStandardMaterial key={programKey()} {...appearance} roughness={finish === "ground" ? .86 : .93} metalness={0} side={finish === "canopy" ? DoubleSide : FrontSide}
    onBeforeCompile={compile} customProgramCacheKey={programKey} />;
});
