import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, DoubleSide, Quaternion, Vector3 } from "three";
import { useSceneLook } from "./SceneLookContext";
import { readAtmosphereFogDensity } from "./atmosphereFog";
import { AUTHORED_SHAFTS, type LightShaftSpec } from "./sceneLightAccents";

function VolumetricLightShaft({ from, to, radius, opacity }: LightShaftSpec) {
  const presentation = useSceneLook()!;
  const pose = useMemo(() => {
    const a = new Vector3(...from), b = new Vector3(...to), direction = a.clone().sub(b);
    return { centre: a.clone().add(b).multiplyScalar(.5), length: direction.length(), rotation: new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.normalize()) };
  }, [from, to]);
  const uniforms = useMemo(() => ({ tint: { value: new Color() }, opacity: { value: opacity }, time: { value: 0 }, fogDensity: { value: 0 } }), [opacity]);
  useFrame(({ scene }) => {
    uniforms.tint.value.set(presentation.look.lighting.color);
    uniforms.time.value = presentation.time.vegetation;
    uniforms.fogDensity.value = readAtmosphereFogDensity(scene.fog);
    uniforms.opacity.value = opacity * (1 - presentation.stillness * .8);
  });
  return <mesh name="authored-light-shaft" position={pose.centre} quaternion={pose.rotation} renderOrder={3}>
    <cylinderGeometry args={[.15, radius, pose.length, 20, 1, true]} />
    <shaderMaterial uniforms={uniforms} side={DoubleSide} transparent depthWrite={false} forceSinglePass
      vertexShader={`varying vec2 vUv;varying vec3 vLocal,vNormal,vView;
        void main(){vUv=uv;vLocal=position;vec4 v=modelViewMatrix*vec4(position,1.);
          vView=-v.xyz;vNormal=normalMatrix*normal;gl_Position=projectionMatrix*v;}`}
      fragmentShader={`uniform vec3 tint;uniform float opacity,time,fogDensity;varying vec2 vUv;varying vec3 vLocal,vNormal,vView;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
        void main(){
          float nearby=smoothstep(.65,2.8,length(vView));
          float depth=max(0.,vView.z);
          float fogFade=exp(-fogDensity*fogDensity*depth*depth);
          float visibility=opacity*nearby*fogFade;
          if(visibility<=.0005) discard;
          float ends=smoothstep(0.,.24,vUv.y)*(1.-smoothstep(.76,1.,vUv.y));
          float facing=abs(dot(normalize(vNormal),normalize(vView)));
          float soft=pow(facing,1.8);
          float dust=.7+.3*noise(vLocal.xz*.65+vec2(vUv.y*3.,time*.025));
          gl_FragColor=vec4(tint,visibility*ends*soft*dust);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
  </mesh>;
}

export function AuthoredLightShafts() {
  const presentation = useSceneLook()!;
  if (!presentation.look.budget.shafts) return null;
  return <>{AUTHORED_SHAFTS[presentation.look.sceneId]?.map((shaft, i) => <VolumetricLightShaft key={`${presentation.look.sceneId}:${i}`} {...shaft} />)}</>;
}
