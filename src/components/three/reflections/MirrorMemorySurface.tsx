import { useSceneLook } from "../artDirection/SceneLookContext";
import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { environmentTime } from "../environment/chapterEnvironment";
import { useTactileDetail } from "../storyEvents/TactileMaterial";

const MIRROR_VERTEX_SHADER = /* glsl */ `
  uniform float uTime;
  uniform float uDistortion;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vMirrorView;
  varying vec3 vMirrorNormal;
  #include <fog_pars_vertex>

  void main() {
    vUv = uv;
    vec3 transformed = position;
    float slowWave = sin((uv.y * 8.0) + uTime * 0.43);
    float crossWave = sin((uv.x * 13.0) - uTime * 0.29);
    float edgeWeight = sin(uv.x * 3.14159265) * sin(uv.y * 3.14159265);
    vWave = (slowWave * 0.62 + crossWave * 0.38) * edgeWeight;
    transformed.z += vWave * uDistortion;
    vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
    vMirrorView = -viewPosition.xyz;
    vMirrorNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewPosition;
    vec4 mvPosition = viewPosition;
    #include <fog_vertex>
  }
`;

const MIRROR_FRAGMENT_SHADER = /* glsl */ `
  uniform vec3 uDeepColor;
  uniform vec3 uSkyColor;
  uniform float uOpacity;
  uniform float uDistortion;
  uniform float uDetail;
  varying vec2 vUv;
  varying float vWave;
  varying vec3 vMirrorView;
  varying vec3 vMirrorNormal;
  #include <fog_pars_fragment>

  float mirrorHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
  float mirrorNoise(vec2 p) {
    vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(mirrorHash(cell),mirrorHash(cell+vec2(1.,0.)),f.x),
      mix(mirrorHash(cell+vec2(0.,1.)),mirrorHash(cell+vec2(1.)),f.x),f.y);
  }

  void main() {
    float horizon = smoothstep(0.05, 0.9, vUv.y + vWave*uDistortion*.26);
    float facing=abs(dot(normalize(vMirrorNormal),normalize(vMirrorView)));
    float fresnel=.06+.94*pow(1.-clamp(facing,0.,1.),4.);
    vec3 color = mix(uDeepColor, uSkyColor, horizon * .64 + fresnel*.15);
    float patina=mirrorNoise(vUv*vec2(7.,9.));
    float perimeter=min(min(vUv.x,1.-vUv.x),min(vUv.y,1.-vUv.y));
    float edgeAge=(1.-smoothstep(.018,.14,perimeter))*smoothstep(.24,.72,patina);
    color=mix(color,vec3(.065,.058,.043),edgeAge*.7);
    if(uDetail>.0) {
      vec2 scratchP=vec2(vUv.x*211.+vUv.y*17.,vUv.y*5.);
      float scratchCell=mirrorHash(floor(scratchP));
      float line=abs(fract(scratchP.x)-.5);
      float filterWidth=max(fwidth(scratchP.x),.02);
      float scratch=(1.-smoothstep(.018,.018+filterWidth,line))*step(.91,scratchCell);
      scratch*=smoothstep(.1,.35,fract(scratchP.y))*(1.-smoothstep(.65,.9,fract(scratchP.y)));
      color+=scratch*.035*uDetail*(.25+edgeAge);
    }
    // Disturbance changes the reflected bands; stillness leaves aged glass,
    // over the optional live scene capture, without changing material identity.
    color+=vec3(.022,.027,.03)*vWave*uDistortion;
    float edge = smoothstep(0.0, 0.11, vUv.x)
      * smoothstep(0.0, 0.11, 1.0 - vUv.x)
      * smoothstep(0.0, 0.08, vUv.y)
      * smoothstep(0.0, 0.08, 1.0 - vUv.y);
    gl_FragColor = vec4(color, uOpacity * (0.86 + edge * 0.14));
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export type MirrorMemorySurfaceProps = {
  width?: number;
  height?: number;
  warm?: boolean;
  still?: boolean;
  reducedMotion?: boolean;
  reducedEffects?: boolean;
};

/**
 * A translucent, GPU-distorted mirror skin. Its instability quietens in the
 * Stillness scene only after measured player stillness, so the story
 * consequence remains readable on fallback tiers and over the live hero view.
 */
function MirrorMemorySurfaceComponent({
  width = 5.4,
  height = 6,
  warm = false,
  still = false,
  reducedMotion = false,
  reducedEffects = false,
}: MirrorMemorySurfaceProps) {
  const presentation = useSceneLook();
  const liveReflection = Boolean(presentation?.look.budget.reflectionSize);
  const materialRef = useRef<THREE.ShaderMaterial>(null);
  const time = useRef(0);
  const detail = useTactileDetail();
  const targetDistortion = reducedMotion || reducedEffects ? 0 : still ? 0 : warm ? 0.065 : 0.04;
  const uniforms = useMemo(
    () => ({
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      uTime: { value: 0 },
      uDistortion: { value: targetDistortion },
      uDeepColor: { value: new THREE.Color(warm ? "#2d1717" : "#101923") },
      uSkyColor: { value: new THREE.Color(warm ? "#a15a40" : "#7995a7") },
      uOpacity: { value: liveReflection ? .16 : reducedEffects ? 0.62 : 0.54 },
      uDetail: { value: reducedEffects || detail === "base" ? 0 : 1 },
    }),
    [detail, reducedEffects, targetDistortion, warm, liveReflection],
  );

  useFrame((_, delta) => {
    const material = materialRef.current;
    if (!material) return;
    time.current = environmentTime(time.current, delta, !document.hidden, reducedMotion || reducedEffects);
    material.uniforms.uTime.value = reducedMotion || reducedEffects ? 0 : presentation ? presentation.time.water : time.current;
    material.uniforms.uDistortion.value = THREE.MathUtils.damp(
      material.uniforms.uDistortion.value,
      targetDistortion,
      3.4,
      Math.min(delta, 0.05),
    );
  });

  return (
    <mesh name="stillness-sensitive-mirror-surface" position={[0, 0, 0.12]} renderOrder={3}>
      <planeGeometry args={[width, height, reducedEffects ? 12 : 24, reducedEffects ? 14 : 28]} />
      <shaderMaterial
        ref={materialRef}
        uniforms={uniforms}
        vertexShader={MIRROR_VERTEX_SHADER}
        fragmentShader={MIRROR_FRAGMENT_SHADER}
        fog
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </mesh>
  );
}

export const MirrorMemorySurface = memo(MirrorMemorySurfaceComponent);
export default MirrorMemorySurface;
