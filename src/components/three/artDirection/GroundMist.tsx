import { useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, FrontSide } from "three";
import { useSceneLook } from "./SceneLookContext";

const WOOD = [[-8, .27, 10, 6, .4, 3.4], [8, .3, 12, 5, .48, 4], [-1, .18, 17, 8, .32, 3]];
const SHORE = [[-8.4, .15, 4, 2.4, .3, 5.5], [8.8, .2, 6, 2.1, .35, 4.2]];
const RIVER = [[8, .17, 7, 3.5, .3, 6], [10, .15, 14, 4, .3, 5]];

/** Low, local mist within the lighting owner's chapter transform. Opaque scene
 * depth occludes these bounded volumes; no screen quad or depth-copy pass. */
export function GroundMist() {
  const presentation = useSceneLook()!;
  const id = presentation.look.sceneId;
  const patches = id.startsWith("enchanted.") ? WOOD : id.startsWith("blue-moon.") ? SHORE : id.startsWith("river.") ? RIVER : [];
  const uniforms = useMemo(() => ({ tint: { value: new Color() }, time: { value: 0 }, opacity: { value: 0 } }), []);
  useFrame(() => {
    uniforms.tint.value.set(presentation.look.atmosphere.horizon);
    uniforms.time.value = presentation.time.vegetation;
    uniforms.opacity.value = .085 * (1 - presentation.stillness * .8);
  });
  if (!presentation.look.budget.shafts || !patches.length) return null;
  return <group name="scene-local-ground-mist">
    {patches.map(([x, y, z, sx, sy, sz], i) => <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]} renderOrder={2}>
      <sphereGeometry args={[1, 12, 6]} />
      <shaderMaterial uniforms={uniforms} side={FrontSide} transparent depthWrite={false}
        vertexShader={`varying vec3 local,viewNormal,viewPosition;void main(){local=position;vec4 v=modelViewMatrix*vec4(position,1.);viewPosition=-v.xyz;viewNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*v;}`}
        fragmentShader={`uniform vec3 tint;uniform float time,opacity;varying vec3 local,viewNormal,viewPosition;
          void main(){float edge=pow(max(0.,dot(normalize(viewNormal),normalize(viewPosition))),1.8);
          float breakup=.65+.35*sin(local.x*4.7+local.z*3.8+time*.018)*sin(local.z*6.2-local.x*2.4);
          float base=smoothstep(-1.,-.35,local.y)*(1.-smoothstep(.2,1.,local.y));
          float nearby=smoothstep(.8,3.,length(viewPosition));gl_FragColor=vec4(tint,opacity*edge*base*breakup*nearby);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`} />
    </mesh>)}
  </group>;
}
