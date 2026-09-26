import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { WorldDirectorState } from "../worldDirector/worldDirector";
import type { WorldVisualState } from "../worldVisualState";
import { useSceneLook } from "../artDirection/SceneLookContext";

type Props = { worldDirector: WorldDirectorState; visualState: WorldVisualState; enabled?: boolean };

/** One bounded draw; world-space seeds and one shared clock, no per-frame buffers. */
export function WorldEnvironmentParticles({ worldDirector, enabled = true }: Props) {
  const presentation = useSceneLook();
  const group = useRef<THREE.Points>(null);
  const profile = presentation?.look.particles;
  const kind = profile?.kind;
  const region = useMemo(() => kind === "ash" ? { center: [0, .1, 4], size: [2.5, 3, 2.5] }
    : kind === "pollen" ? { center: [-1.8, .6, 5], size: [5, 5.5, 7] }
    : kind === "dust" ? { center: [-1.5, .8, 4], size: [4, 2.5, 4] }
    : { center: [5, .1, 5], size: [3, 1.1, 9] }, [kind]);
  const count = enabled && !presentation?.reducedEffects ? Math.min(56, Math.round((profile?.count ?? 0) * Math.min(1, worldDirector.performance.particleScale))) : 0;
  const geometry = useMemo(() => {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Coprime sequences distribute quiet, non-emissive matter without random remounts.
      points[i * 3] = region.center[0] + ((i * 17 % 59) / 59 - .5) * region.size[0];
      points[i * 3 + 1] = region.center[1] + (i * 23 % 61) / 61 * region.size[1];
      points[i * 3 + 2] = region.center[2] + ((i * 31 % 67) / 67 - .5) * region.size[2];
    }
    return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(points, 3));
  }, [count, region]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ time: { value: 0 }, size: { value: 1 }, opacity: { value: 0 }, tint: { value: new THREE.Color() }, drift: { value: .1 }, base: { value: 0 }, height: { value: 1 } }), []);
  useFrame(({ gl }) => {
    if (!group.current || !profile || !presentation) return;
    // Air stays at its cause when the player walks away from the beam or fire.
    uniforms.time.value = presentation.time.particles;
    uniforms.size.value = profile.size * Math.min(gl.getPixelRatio(), 1.5);
    // Shared quietness removes the layer as its clock settles; no second tail.
    uniforms.opacity.value = profile.opacity * (1 - presentation.stillness);
    uniforms.tint.value.set(profile.color);
    uniforms.drift.value = profile.drift;
    uniforms.base.value = region.center[1]; uniforms.height.value = region.size[1];
  });
  if (!count) return null;
  return <points name={`scene-particulate:${profile?.kind}`} ref={group} geometry={geometry} position={presentation?.origin} rotation={[0, presentation?.heading ?? 0, 0]} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`uniform float time,size,drift,base,height;void main(){vec3 p=position;p.x+=sin(time*.13+position.z)*.14;p.y=base+mod(p.y-base+time*drift,height);p.z+=sin(time*.16+position.x)*.12;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(size*9./max(3.,-v.z),.7,3.);}`}
      fragmentShader={`uniform vec3 tint;uniform float opacity;void main(){float a=1.-smoothstep(.08,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(tint,a*opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`} />
  </points>;
}
export default WorldEnvironmentParticles;
