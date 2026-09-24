import { memo, useEffect, useMemo } from "react";
import { DoubleSide } from "three";
import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { createApparitionGeometry } from "../environmentArt/heroGeometry";

/** An uncertain, fading silhouette on the mirror plane, never a physical NPC. */
export const ReflectionApparition = memo(function ReflectionApparition({ apparition = false }: { apparition?: boolean }) {
  const geometry = useMemo(createApparitionGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const silhouette = <mesh geometry={geometry}>
    <shaderMaterial transparent depthWrite={false} side={DoubleSide} uniforms={{ strength: { value: apparition ? .1 : .17 } }}
      vertexShader={`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform float strength;varying vec2 p;void main(){
        float fade=smoothstep(.12,.88,p.y)*(1.-smoothstep(1.63,1.78,p.y));
        float soft=1.-smoothstep(.19,.39,abs(p.x+.024*sin(p.y*4.)));
        float missing=mix(.25,1.,smoothstep(-.12,.18,p.x+sin(p.y*6.4)*.045));
        gl_FragColor=vec4(.32,.39,.39,strength*fade*soft*missing);}`} />
  </mesh>;
  return <group name={apparition ? "apparition-behind-player" : "delayed-player-reflection"}>
    {apparition ? <HeroAssetSlot id="seer-reflection">{silhouette}</HeroAssetSlot> : silhouette}
  </group>;
});
export default ReflectionApparition;
