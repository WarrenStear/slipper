import { memo, useEffect, useMemo } from "react";
import { DoubleSide, Shape, ShapeGeometry } from "three";
import { HeroAssetSlot } from "../actors/HeroAssetSlot";

/** An uncertain, fading silhouette on the mirror plane, never a physical NPC. */
export const ReflectionApparition = memo(function ReflectionApparition({ apparition = false }: { apparition?: boolean }) {
  const geometry = useMemo(() => {
    const s = new Shape(); s.moveTo(-.34,0);s.bezierCurveTo(-.28,.3,-.35,.9,-.2,1.13);
    s.quadraticCurveTo(-.11,1.21,-.12,1.34);s.bezierCurveTo(-.28,1.72,.24,1.78,.15,1.35);
    s.quadraticCurveTo(.1,1.22,.24,1.15);s.bezierCurveTo(.38,.91,.27,.35,.31,0);s.closePath();
    return new ShapeGeometry(s,12);
  }, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  const silhouette = <mesh geometry={geometry}>
    <shaderMaterial transparent depthWrite={false} side={DoubleSide} uniforms={{ strength: { value: apparition ? .13 : .23 } }}
      vertexShader={`varying vec2 p;void main(){p=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`}
      fragmentShader={`uniform float strength;varying vec2 p;void main(){float fade=smoothstep(0.,.65,p.y)*(1.-smoothstep(1.57,1.75,p.y));float soft=1.-smoothstep(.14,.36,abs(p.x));gl_FragColor=vec4(.35,.43,.44,strength*fade*soft);}`} />
  </mesh>;
  return <group name={apparition ? "apparition-behind-player" : "delayed-player-reflection"}>
    {apparition ? <HeroAssetSlot id="seer-reflection">{silhouette}</HeroAssetSlot> : silhouette}
  </group>;
});
export default ReflectionApparition;
