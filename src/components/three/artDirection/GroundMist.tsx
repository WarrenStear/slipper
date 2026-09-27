import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, FrontSide } from "three";
import { useSceneLook } from "./SceneLookContext";

const WOOD = [[-8, .27, 10, 6, .4, 3.4], [8, .3, 12, 5, .48, 4], [-1, .18, 17, 8, .32, 3]];
const SHORE = [[-8.4, .15, 4, 2.4, .3, 5.5], [8.8, .2, 6, 2.1, .35, 4.2]];
const RIVER = [[8, .17, 7, 3.5, .3, 6], [10, .15, 14, 4, .3, 5]];

/** Bounded, depth-tested mist; two noise scales break up the old regular bands.
 * Existing patch counts and placement are retained. No depth-copy or full-screen pass. */
export function GroundMist() {
  const presentation = useSceneLook()!;
  const id = presentation.look.sceneId;
  const patches = id.startsWith("enchanted.") ? WOOD : id.startsWith("blue-moon.") ? SHORE : id.startsWith("river.") ? RIVER : [];
  const uniforms = useMemo(() => ({ tint: { value: new Color() }, time: { value: 0 }, opacity: { value: 0 } }), []);
  useFrame(() => {
    uniforms.tint.value.set(presentation.look.atmosphere.horizon);
    uniforms.time.value = presentation.time.vegetation;
    uniforms.opacity.value = (id.startsWith("blue-moon.") ? .065 : .085) * (1 - presentation.stillness * .8);
  });
  if (!presentation.look.budget.shafts || !patches.length) return null;
  return <group name="scene-local-ground-mist">
    {patches.map(([x, y, z, sx, sy, sz], i) => <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]} renderOrder={2}>
      <sphereGeometry args={[1, 12, 6]} />
      <shaderMaterial uniforms={uniforms} side={FrontSide} transparent depthWrite={false}
        vertexShader={`varying vec3 local,viewNormal,viewPosition;void main(){local=position;vec4 v=modelViewMatrix*vec4(position,1.);viewPosition=-v.xyz;viewNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*v;}`}
        fragmentShader={`uniform vec3 tint;uniform float time,opacity;varying vec3 local,viewNormal,viewPosition;
          float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
          float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
          void main(){
            float edge=pow(max(0.,dot(normalize(viewNormal),normalize(viewPosition))),1.8);
            vec2 drift=vec2(time*.018,-time*.012);
            float billow=noise(local.xz*2.3+drift)*.65+noise(local.xz*5.1-drift*.7)*.35;
            float breakup=smoothstep(.16,.78,billow);
            float base=smoothstep(-1.,-.35,local.y)*(1.-smoothstep(.2,1.,local.y));
            float nearby=smoothstep(.8,3.,length(viewPosition));
            gl_FragColor=vec4(tint,opacity*edge*base*breakup*nearby);
            #include <tonemapping_fragment>
            #include <colorspace_fragment>
          }`} />
    </mesh>)}
  </group>;
}
