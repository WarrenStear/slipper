import { memo, useCallback, useMemo } from "react";
import { DoubleSide, FrontSide, type MeshStandardMaterial } from "three";
import { useTactileDetail } from "../storyEvents/TactileMaterial";
import { applyTactileShader } from "../storyEvents/tactileShader";
import { applyFoliageFinish } from "./foliageFinish";
import { useSceneLook } from "../artDirection/SceneLookContext";

/** Shared opaque leaf finish. No alpha sorting, shadow pass, or texture allocation. */
export const FoliageMaterial = memo(function FoliageMaterial({ color, vertexColors = false, doubleSided = false, flexibility = 0 }: {
  color: string; vertexColors?: boolean; doubleSided?: boolean; flexibility?: number;
}) {
  const detail = useTactileDetail();
  const presentation = useSceneLook();
  const wind = useMemo(() => ({ value: [0, 0] }), []);
  const updateWind = useCallback(() => {
    wind.value[0] = presentation?.time.vegetation ?? 0;
    wind.value[1] = detail === "relief" && presentation && !presentation.reducedMotion && !presentation.reducedEffects
      ? flexibility * (1 - presentation.stillness) : 0;
  }, [detail, flexibility, presentation, wind]);
  const compile = useCallback((shader: Parameters<MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, "moss", detail);
    applyFoliageFinish(shader, detail === "relief");
    if (flexibility > 0) {
      shader.uniforms.habitatWind = wind;
      shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nuniform vec2 habitatWind;")
        .replace("#include <begin_vertex>", `#include <begin_vertex>
          // Seed each plant from its stable instance origin. Roots stay fixed;
          // tall rush tips flex more than low, stiff fern fronds.
          vec3 plantOrigin = vec3(0.);
          #ifdef USE_INSTANCING
            plantOrigin = instanceMatrix[3].xyz;
          #endif
          float tip = pow(clamp(position.y, 0., 1.8), 2.);
          float phase = dot(plantOrigin.xz, vec2(1.73, 2.91));
          float breeze = sin(habitatWind.x * .67 + phase) * .7 + sin(habitatWind.x * .29 + phase * 2.3) * .3;
          transformed.x += breeze * tip * habitatWind.y;
          transformed.z += sin(habitatWind.x * .43 + phase * .71) * tip * habitatWind.y * .4;
        `);
    }
  }, [detail, flexibility, wind]);
  const key = useCallback(() => `sidtw-foliage-v2-${detail}-${flexibility > 0}`, [detail, flexibility]);
  return <meshStandardMaterial key={key()} color={color} vertexColors={vertexColors} roughness={.92} metalness={0}
    side={doubleSided ? DoubleSide : FrontSide} onBeforeRender={updateWind} onBeforeCompile={compile} customProgramCacheKey={key} />;
});
