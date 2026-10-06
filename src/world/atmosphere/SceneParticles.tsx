import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { sceneParticleCount, sceneParticlePositions, sceneParticleRegion } from "./sceneParticleModel";

type Props = { particleScale: number; enabled?: boolean };

/** Canonical airborne matter. A disabled layer mounts no buffers or frame consumer. */
export function SceneParticles({ particleScale, enabled = true }: Props) {
  const presentation = useSceneLook();
  const count = presentation ? sceneParticleCount(presentation.look.particles.count, particleScale, enabled, presentation.reducedEffects, presentation.look.sceneId) : 0;
  return count ? <ParticleBatch count={count} /> : null;
}

/** One bounded draw; world-space seeds and one shared clock, no per-frame buffers. */
function ParticleBatch({ count }: { count: number }) {
  const presentation = useSceneLook()!;
  const group = useRef<THREE.Points>(null);
  const profile = presentation.look.particles;
  const region = useMemo(() => sceneParticleRegion(profile.kind), [profile.kind]);
  const geometry = useMemo(() => {
    const points = sceneParticlePositions(count, region);
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
  return <points name={`scene-particulate:${profile?.kind}`} ref={group} geometry={geometry} position={presentation?.origin} rotation={[0, presentation?.heading ?? 0, 0]} frustumCulled={false}>
    <shaderMaterial transparent depthWrite={false} uniforms={uniforms}
      vertexShader={`uniform float time,size,drift,base,height;void main(){vec3 p=position;p.x+=sin(time*.13+position.z)*.14;p.y=base+mod(p.y-base+time*drift,height);p.z+=sin(time*.16+position.x)*.12;vec4 v=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*v;gl_PointSize=clamp(size*9./max(3.,-v.z),.7,3.);}`}
      fragmentShader={`uniform vec3 tint;uniform float opacity;void main(){float a=1.-smoothstep(.08,.5,length(gl_PointCoord-.5));gl_FragColor=vec4(tint,a*opacity);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`} />
  </points>;
}
export default SceneParticles;
