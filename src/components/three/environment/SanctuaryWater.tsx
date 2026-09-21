import { memo, useCallback, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { environmentTime } from "./chapterEnvironment";
type Shader = Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0];

/** One opaque lit surface replaces the previous translucent water plane.
 * No reflection render target, framebuffer copies, transmission or extra pass. */
export const SanctuaryWater = memo(function SanctuaryWater({ reducedMotion, reducedEffects }: { reducedMotion: boolean; reducedEffects: boolean }) {
  const time = useRef(0);
  // Keep the compiled shader attached to the same uniform objects when settings change.
  const uniforms = useMemo(() => ({ waterTime: { value: 0 }, waterDetail: { value: 1 } }), []);
  const compile = useCallback((shader: Shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader.replace("#include <common>", "#include <common>\nvarying vec2 vWaterUv;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvWaterUv=uv;");
    shader.fragmentShader = shader.fragmentShader.replace("#include <common>", "#include <common>\nvarying vec2 vWaterUv; uniform float waterTime; uniform float waterDetail;")
      .replace("#include <color_fragment>", `#include <color_fragment>
        vec2 waterP=vWaterUv*vec2(20.,17.);
        float ripples=sin(waterP.x*2.8+waterP.y*.7+waterTime*.24)*sin(waterP.y*3.4-waterTime*.18);
        float bank=smoothstep(.02,.18,min(vWaterUv.x,1.-vWaterUv.x));
        diffuseColor.rgb*=mix(.57,1.,bank)*(1.+ripples*.035*waterDetail);`)
      .replace("#include <normal_fragment_maps>", `#include <normal_fragment_maps>
        float waterSlopeX=cos(vWaterUv.x*56.+vWaterUv.y*12.+waterTime*.24)*.055*waterDetail;
        float waterSlopeY=sin(vWaterUv.y*58.-waterTime*.18)*.035*waterDetail;
        vec3 waterTangent=normalize(dFdx(vViewPosition));
        vec3 waterBitangent=normalize(dFdy(vViewPosition));
        normal=normalize(normal+waterTangent*waterSlopeX+waterBitangent*waterSlopeY);`);
  }, [uniforms]);
  useFrame((_, delta) => {
    time.current = environmentTime(time.current, delta, !document.hidden, reducedMotion);
    uniforms.waterTime.value = reducedMotion ? 0 : time.current;
    uniforms.waterDetail.value = reducedEffects ? .5 : 1;
  });
  return <mesh name="moonlit-sanctuary-water" position={[0, .01, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
    <planeGeometry args={[20, 17]} />
    <meshStandardMaterial color="#234453" roughness={.26} metalness={.3} onBeforeCompile={compile} customProgramCacheKey={() => "sidtw-sanctuary-water-v1"} />
  </mesh>;
});
