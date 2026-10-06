import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, FogExp2, Vector3, type Mesh } from "three";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { worldTransitionAlpha } from "../../components/three/artDirection/worldVisualContinuity";
import { bindSceneAtmosphere } from "./atmosphereOwnership";

export function SceneAtmosphere({ heading = 0 }: { heading?: number }) {
  const presentation = useSceneLook()!;
  const { scene } = useThree();
  const sky = useRef<Mesh>(null);
  const owned = useMemo(() => ({ background: new Color(presentation.look.atmosphere.sky), fog: new FogExp2(presentation.look.atmosphere.fog, presentation.look.atmosphere.density), target: new Color(), horizon: new Color(presentation.look.atmosphere.horizon), zenith: new Color(presentation.look.atmosphere.sky) }), []);
  const uniforms = useMemo(() => ({ horizon: { value: owned.horizon }, zenith: { value: owned.zenith }, sun: { value: new Vector3() }, time: { value: 0 }, structure: { value: 0 } }), [owned]);
  useLayoutEffect(() => bindSceneAtmosphere(scene, owned.background, owned.fog), [scene, owned]);
  useFrame(({ camera }, delta) => {
    const { look } = presentation, profile = getCurrentCinematicProfile();
    const alpha = worldTransitionAlpha(delta, presentation.reducedMotion);
    owned.background.lerp(owned.target.set(look.atmosphere.sky), alpha);
    owned.zenith.copy(owned.background);
    owned.horizon.lerp(owned.target.set(look.atmosphere.horizon), alpha);
    owned.fog.color.lerp(owned.target.set(look.atmosphere.fog), alpha);
    const density = Math.min(.025, profile.fogDensity * Math.min(1.3, 90 / profile.visibility));
    owned.fog.density += (density - owned.fog.density) * alpha;
    uniforms.time.value = presentation.time.vegetation;
    uniforms.structure.value = presentation.reducedEffects || !look.budget.shafts ? 0 : .055;
    const [x, y, z] = look.lighting.position;
    uniforms.sun.value.set(x * Math.cos(heading) + z * Math.sin(heading), y, z * Math.cos(heading) - x * Math.sin(heading)).normalize();
    sky.current?.position.copy(camera.position);
  }, 0);
  return <mesh ref={sky} name="scene-directed-sky" renderOrder={-100} frustumCulled={false}>
    <sphereGeometry args={[170, 24, 12]} />
    <shaderMaterial uniforms={uniforms} side={BackSide} depthWrite={false}
      vertexShader={`varying vec3 direction; void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform vec3 horizon,zenith,sun;uniform float time,structure;varying vec3 direction;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float cloud(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){vec3 d=normalize(direction);float h=pow(smoothstep(-.08,.72,d.y),.65);vec3 color=mix(horizon,zenith,h);
        // Uniform branch skips both noise octaves on low/medium/reduced effects.
        if (structure > .001) {
        float veil=cloud(d*5.+vec3(time*.002,0.,0.))*.7+cloud(d*11.-vec3(0.,0.,time*.001))*.3;
        float glow=pow(max(0.,dot(d,sun)),24.);float haze=exp(-abs(d.y)*12.);
        color=mix(color,horizon,(veil*.55+glow*.4+haze*.15)*structure);
        }
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }
      `} />
  </mesh>;
}
