import { PlaneGeometry } from "three";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { memo, useMemo, useEffect } from "react";
import { Forms } from "./EnvironmentDressing";
import type { DressingForm } from "./chapterEnvironment";
import { BotanicalBatch, type BotanicalPlacement } from "../environmentArt/EnvironmentArt";

/** Decoration stays outside the authored walk and interaction targets. */
export const ClimbLandscape = memo(function ClimbLandscape({ kind, released }: { kind: "mind" | "heart" | "womb"; released: boolean }) {
  const layout = useMemo(() => {
    const stones: DressingForm[] = [], planting: BotanicalPlacement[] = [];
    if (kind === "mind") {
      for (let i = 0; i < 12; i++) for (const side of [-1, 1]) {
        if (released && i < 5) continue;
        const height = 3 + (i % 3) * 1.4 + Math.max(0,i-7)*.35;
        stones.push({ position: [side * (5.7 + i * .18), height / 2, -6 + i * 2.8], scale: [.75, height, 1.3], rotation: [0, side * .14, side * -.08] });
      }
    } else if (kind === "heart") {
      for (let i = 0; i < 17; i++) {
        const angle = .1 + i / 16 * Math.PI * .94;
        const x = Math.cos(angle) * (kind === "heart" ? 8.5 : 10), z = 5 + Math.sin(angle) * 6;
        stones.push({ position: [x, .4, z], scale: [1.2, kind === "heart" ? .8 : .55, 1.1], rotation: [.05, angle, -.04] });
        if (kind === "heart") planting.push({ position: [x, .35, z + .5], scale: .9, rotation: [0, angle, 0] });
      }
    }
    if (kind === "womb") for (let i=0;i<9;i++) {
      const a=i*.71; planting.push({position:[Math.cos(a)*9.8,.35,4+Math.sin(a)*8.4],scale:[.7,.32+i%3*.08,.7],rotation:[0,a,0]});
    }
    return { stones, planting };
  }, [kind, released]);
  const bowl = useMemo(() => {
    if (kind !== "womb") return null;
    const g = new PlaneGeometry(28,28,32,32);g.rotateX(-Math.PI/2);
    const p=g.getAttribute("position");
    for(let i=0;i<p.count;i++){const x=p.getX(i),z=p.getZ(i),r=Math.hypot(x,z-3);const rise=Math.exp(-Math.pow((r-9)/2.8,2))*.72;p.setY(i,.035+rise*(.85+.15*Math.sin(x*.5+z*.2)));}
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  },[kind]);
  useEffect(()=>()=>bowl?.dispose(),[bowl]);
  return <group name={`climb-${kind}-spatial-grammar`} userData={{ language: kind === "mind" ? "repetition-into-space" : kind === "heart" ? "curved-intimate-shelter" : "open-protected-earth" }}>
    <Forms forms={layout.stones} name="climb-authored-boundary" kind={kind === "mind" ? "box" : "stone"} surface="stone" color={kind === "womb" ? "#71664f" : "#65706a"} />
    {bowl ? <mesh name="creation-soft-protected-earth" geometry={bowl} receiveShadow><TactileMaterial surface="earth" color="#847a61" roughness={.96} /></mesh> : null}
    {kind !== "mind" ? <BotanicalBatch kind="reeds" placements={layout.planting} mergeFoliage /> : null}
  </group>;
});
