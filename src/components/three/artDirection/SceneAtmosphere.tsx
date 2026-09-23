import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, FogExp2, type Mesh } from "three";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useSceneLook } from "./SceneLookContext";

export function SceneAtmosphere() {
  const presentation = useSceneLook()!;
  const { scene } = useThree();
  const sky = useRef<Mesh>(null);
  const owned = useMemo(() => ({ background: new Color(presentation.look.atmosphere.sky), fog: new FogExp2(presentation.look.atmosphere.fog, presentation.look.atmosphere.density), target: new Color(), horizon: new Color(presentation.look.atmosphere.horizon), zenith: new Color(presentation.look.atmosphere.sky) }), []);
  const uniforms = useMemo(() => ({ horizon: { value: owned.horizon }, zenith: { value: owned.zenith } }), [owned]);
  useEffect(() => {
    const previous = { background: scene.background, fog: scene.fog };
    scene.background = owned.background; scene.fog = owned.fog;
    return () => { if (scene.background === owned.background) scene.background = previous.background; if (scene.fog === owned.fog) scene.fog = previous.fog; };
  }, [scene, owned]);
  useFrame(({ camera }, delta) => {
    const { look } = presentation, profile = getCurrentCinematicProfile();
    const alpha = presentation.reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, .05) * 2);
    owned.background.lerp(owned.target.set(look.atmosphere.sky), alpha);
    owned.zenith.copy(owned.background);
    owned.horizon.lerp(owned.target.set(look.atmosphere.horizon), alpha);
    owned.fog.color.lerp(owned.target.set(look.atmosphere.fog), alpha);
    const density = Math.min(.025, profile.fogDensity * Math.min(1.3, 90 / profile.visibility));
    owned.fog.density += (density - owned.fog.density) * alpha;
    sky.current?.position.copy(camera.position);
  }, -1);
  return <mesh ref={sky} name="scene-directed-sky" renderOrder={-100} frustumCulled={false}>
    <sphereGeometry args={[170, 24, 12]} />
    <shaderMaterial uniforms={uniforms} side={BackSide} depthWrite={false}
      vertexShader={`varying vec3 direction; void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform vec3 horizon,zenith;varying vec3 direction;void main(){float h=pow(smoothstep(-.08,.72,normalize(direction).y),.65);gl_FragColor=vec4(mix(horizon,zenith,h),1.);#include <tonemapping_fragment>\n#include <colorspace_fragment>}`.replace(";#include", ";\n#include")} />
  </mesh>;
}
