import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, Quaternion, Vector3 } from "three";
import { useSceneLook } from "./SceneLookContext";
import type { LookPoint } from "./SceneLookRegistry";

function VolumetricLightShaft({ from, to, radius, opacity }: { from: LookPoint; to: LookPoint; radius: number; opacity: number }) {
  const presentation = useSceneLook()!;
  const pose = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = a.clone().sub(b);
    return { centre: a.clone().add(b).multiplyScalar(.5), length: direction.length(), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()) };
  }, [from, to]);
  const uniforms = useMemo(() => ({ tint: { value: new Color() }, opacity: { value: opacity }, time: { value: 0 } }), [opacity]);
  useFrame(() => { uniforms.tint.value.set(presentation.look.lighting.color); uniforms.time.value = presentation.time.vegetation; });
  return <mesh name="authored-light-shaft" position={pose.centre} quaternion={pose.rotation} renderOrder={3}>
    <cylinderGeometry args={[.15, radius, pose.length, 16, 1, true]} />
    <shaderMaterial uniforms={uniforms} side={DoubleSide} transparent depthWrite={false}
      vertexShader={`varying vec2 vUv;varying float facing;void main(){vUv=uv;vec4 v=modelViewMatrix*vec4(position,1.);facing=abs(dot(normalize(normalMatrix*normal),normalize(-v.xyz)));gl_Position=projectionMatrix*v;}`}
      fragmentShader={`uniform vec3 tint;uniform float opacity,time;varying vec2 vUv;varying float facing;void main(){float ends=smoothstep(0.,.24,vUv.y)*(1.-smoothstep(.76,1.,vUv.y));float soft=pow(facing,1.8);float dust=.94+.06*sin(vUv.y*19.+vUv.x*7.+time*.12);gl_FragColor=vec4(tint,opacity*ends*soft*dust);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`} />
  </mesh>;
}

const SHAFTS: Record<string, { from: LookPoint; to: LookPoint; radius: number; opacity: number }[]> = {
  "broken-floor.confession": [{ from: [5.8, 5.2, -6], to: [-1, .25, 2], radius: 2.6, opacity: .025 }],
  "enchanted.rabbit-hole": [{ from: [-7, 13, 8], to: [-2, 0, 5], radius: 2.8, opacity: .035 }, { from: [-5, 14, 15], to: [2, 0, 10], radius: 2, opacity: .025 }],
  "enchanted.friendship-meadow": [{ from: [-7, 13, 8], to: [0, 0, 4], radius: 3, opacity: .03 }],
  "thorned.self-owned-world": [{ from: [0, 5, 12], to: [0, .2, 3], radius: 2.2, opacity: .035 }],
  "crowned.home": [{ from: [-8, 6, -4], to: [1, .1, 4], radius: 3.4, opacity: .025 }],
  "crowned.sovereignty": [{ from: [-8, 6, -4], to: [1, .1, 4], radius: 3.4, opacity: .025 }],
};
export function AuthoredLightShafts() {
  const presentation = useSceneLook()!;
  if (!presentation.look.budget.shafts) return null;
  return <>{SHAFTS[presentation.look.sceneId]?.map((shaft, i) => <VolumetricLightShaft key={i} {...shaft} />)}</>;
}
