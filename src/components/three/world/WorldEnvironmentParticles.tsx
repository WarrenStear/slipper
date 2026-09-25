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
  const count = enabled && !presentation?.reducedEffects ? Math.min(56, Math.round((profile?.count ?? 0) * Math.min(1, worldDirector.performance.particleScale))) : 0;
  const geometry = useMemo(() => {
    const points = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Coprime sequences distribute quiet, non-emissive matter without random remounts.
      points[i * 3] = ((i * 17 % 59) / 59 - .5) * 22;
      points[i * 3 + 1] = (i * 23 % 61) / 61 * 7;
      points[i * 3 + 2] = ((i * 31 % 67) / 67 - .5) * 22;
    }
    return new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(points, 3));
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const uniforms = useMemo(() => ({ time: { value: 0 }, size: { value: 1 }, opacity: { value: 0 }, tint: { value: new THREE.Color() }, drift: { value: .1 } }), []);
  useFrame(({ camera, gl }) => {
    if (!group.current || !profile || !presentation) return;
    // Camera translation is user control, not environmental animation.
    group.current.position.set(camera.position.x, 0, camera.position.z);
    uniforms.time.value = presentation.time.particles;
    uniforms.size.value = profile.size * Math.min(gl.getPixelRatio(), 1.5);
    // Shared quietness removes the layer as its clock settles; no second tail.
    uniforms.opacity.value = profile.opacity * (1 - presentation.stillness);
    uniforms.tint.value.set(profile.color);
    uniforms.drift.value = profile.drift;
  });
  if (!count) return null;
  return <points name={`scene-particulate:${profile?.kind}`} ref={group} geometry={geometry} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`uniform float time,size,drift;void main(){vec3 p=position;p.x=mod(p.x+11.+time*drift*.36,22.)-11.;p.y=mod(p.y+time*drift,7.);p.z+=sin(time*.16+position.x)*.12;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(size*9./max(3.,-v.z),.7,3.);}`}
      fragmentShader={`uniform vec3 tint;uniform float opacity;void main(){float a=1.-smoothstep(.08,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(tint,a*opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`} />
  </points>;
}
export default WorldEnvironmentParticles;
