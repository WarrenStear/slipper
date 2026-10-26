import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useTexture } from "@react-three/drei";
import { MOON_ALBEDO_PATH } from "./CelestialMoon";
import { useFrame, useThree } from "@react-three/fiber";
import { BackSide, Color, FogExp2, Vector3, SRGBColorSpace, type Mesh } from "three";
import { getCurrentCinematicProfile } from "../../cinematics/emotionalCinematography";
import { useSceneLook } from "../../components/three/artDirection/SceneLookContext";
import { worldTransitionAlpha } from "../../components/three/artDirection/worldVisualContinuity";
import { bindSceneAtmosphere } from "./atmosphereOwnership";
import { forestFogDensity } from "./forestDepth.ts";

export function SceneAtmosphere({ heading = 0 }: { heading?: number }) {
  const presentation = useSceneLook()!;
  const { scene } = useThree();
  const sky = useRef<Mesh>(null);
  const sourceMoon = useTexture(MOON_ALBEDO_PATH);
  const moonMap = useMemo(() => { const texture = sourceMoon.clone(); texture.colorSpace = SRGBColorSpace; texture.needsUpdate = true; return texture; }, [sourceMoon]);
  useEffect(() => () => moonMap.dispose(), [moonMap]);
  const owned = useMemo(() => ({ background: new Color(presentation.look.atmosphere.sky), fog: new FogExp2(presentation.look.atmosphere.fog, forestFogDensity(presentation.look.atmosphere.density, presentation.look.composition)), target: new Color(), horizon: new Color(presentation.look.atmosphere.horizon), zenith: new Color(presentation.look.atmosphere.sky) }), []);
  const uniforms = useMemo(() => ({ horizon: { value: owned.horizon }, zenith: { value: owned.zenith }, sun: { value: new Vector3() }, time: { value: 0 }, structure: { value: 0 }, moonMap: { value: moonMap }, blueMoon: { value: 0 } }), [owned, moonMap]);
  useLayoutEffect(() => bindSceneAtmosphere(scene, owned.background, owned.fog), [scene, owned]);
  useFrame(({ camera }, delta) => {
    const { look } = presentation, profile = getCurrentCinematicProfile();
    const alpha = worldTransitionAlpha(delta, presentation.reducedMotion);
    owned.background.lerp(owned.target.set(look.atmosphere.sky), alpha);
    owned.zenith.copy(owned.background);
    owned.horizon.lerp(owned.target.set(look.atmosphere.horizon), alpha);
    owned.fog.color.lerp(owned.target.set(look.atmosphere.fog), alpha);
    const density = forestFogDensity(Math.min(.025, profile.fogDensity * Math.min(1.3, 90 / profile.visibility)), look.composition);
    owned.fog.density += (density - owned.fog.density) * alpha;
    uniforms.time.value = presentation.time.vegetation;
    const moonVisible = look.lighting.source !== "window" && look.lighting.source !== "domestic" ? 1 : 0;
    uniforms.blueMoon.value += (moonVisible - uniforms.blueMoon.value) * alpha;
    uniforms.structure.value = presentation.reducedEffects || !look.budget.shafts ? 0 : .32;
    const [x, y, z] = look.lighting.position;
    uniforms.sun.value.set(x * Math.cos(heading) + z * Math.sin(heading), y, z * Math.cos(heading) - x * Math.sin(heading)).normalize();
    sky.current?.position.copy(camera.position);
  }, 0);
  return <mesh ref={sky} name="scene-directed-sky" renderOrder={-100} frustumCulled={false}>
    <sphereGeometry args={[170, 24, 12]} />
    <shaderMaterial uniforms={uniforms} side={BackSide} depthWrite={false}
      vertexShader={`varying vec3 direction; void main(){direction=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform vec3 horizon,zenith,sun;uniform float time,structure,blueMoon;uniform sampler2D moonMap;varying vec3 direction;
        float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
        float cloud(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
        void main(){vec3 d=normalize(direction);float h=pow(smoothstep(-.08,.72,d.y),.65);vec3 color=mix(horizon,zenith,h);
        // Uniform branch skips both noise octaves on low/medium/reduced effects.
        if (structure > .001) {
        float veil=cloud(d*5.+vec3(time*.002,0.,0.))*.7+cloud(d*11.-vec3(0.,0.,time*.001))*.3;
        float glow=pow(max(0.,dot(d,sun)),24.);float haze=exp(-abs(d.y)*12.);
        color=mix(color,horizon,(veil*.55+glow*.4+haze*.15)*structure);
        }
        // One world-direction moon, painted into the distant sky. It stays
        // behind all geometry and is retained on low/reduced-effects tiers.
        if (blueMoon > .001) {
          vec3 moonDirection=normalize(vec3(.27,.36,.91));
          vec3 right=normalize(cross(vec3(0.,1.,0.),moonDirection));
          vec3 up=cross(moonDirection,right);
          float angle=acos(clamp(dot(d,moonDirection),-1.,1.));
          float disc=1.-smoothstep(.0415,.043,angle);
          float halo=exp(-max(0.,angle-.043)*40.)*.13*blueMoon;
          color+=vec3(.12,.29,.58)*halo;
          if (disc > .001) {
            vec2 lunarUv=vec2(dot(d,right),dot(d,up))/sin(.043)*.5+.5;
            vec3 albedo=texture2D(moonMap,lunarUv).rgb;
            float terrain=dot(albedo,vec3(.2126,.7152,.0722));
            float limb=sqrt(max(0.,1.-pow(angle/.043,2.)));
            vec3 lunar=vec3(.38,.63,1.)*(.45+terrain*.95)*(.72+limb*.28);
            color=mix(color,lunar,disc*blueMoon);
          }
        }
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }
      `} />
  </mesh>;
}
