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
        const height = 3.2 + i * .31 + Math.sin(i * 1.8) * .42;
        stones.push({ position: [side * (5.7 - Math.min(i, 6) * .12 + Math.max(0, i - 6) * .29), height / 2, -6 + i * 2.8], scale: [.55 + i % 3 * .13, height, 1.08 + i % 2 * .23], rotation: [.012 * side, side * .08 + Math.sin(i) * .04, side * -.026] });
      }
    } else if (kind === "heart") {
      for (let i = 0; i < 17; i++) {
        const angle = .1 + i / 16 * Math.PI * .94;
        const x = Math.cos(angle) * (6.9 + Math.sin(i * 2.1) * .5), z = 4.1 + Math.sin(angle) * 5.5;
        stones.push({ position: [x, .4, z], scale: [1.45 + Math.sin(i) * .3, .55 + (i % 3) * .18, 1.3], rotation: [.05, angle, -.04] });
        if (kind === "heart") planting.push({ position: [x, .35, z + .5], scale: [.75 + i % 3 * .19, .5 + i % 4 * .13, .8], rotation: [0, angle, 0] });
      }
    }
    if (kind === "womb") for (let i=0;i<9;i++) {
      const a=.12+i*.31; planting.push({position:[Math.cos(a)*(10+i%3),.28,3+Math.sin(a)*9],scale:[.65,.23+i%3*.07,.65],rotation:[0,a,0]});
    }
    return { stones, planting };
  }, [kind, released]);
  const bowl = useMemo(() => {
    if (kind !== "womb") return null;
    const g = new PlaneGeometry(28,28,32,32);g.rotateX(-Math.PI/2);
    const p=g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      // Three overlapping earth shoulders leave the arrival open; no radial ring.
      const left = 1.12 * Math.exp(-((x + 9.7) ** 2 / 14 + (z - 4) ** 2 / 60));
      const right = .87 * Math.exp(-((x - 10.5) ** 2 / 18 + (z - 6.8) ** 2 / 43));
      const back = 1.04 * Math.exp(-(x * x / 76 + (z - 12) ** 2 / 12));
      p.setY(i, .035 + left + right + back);
    }
    g.computeVertexNormals();g.computeBoundingSphere();return g;
  },[kind]);
  useEffect(()=>()=>bowl?.dispose(),[bowl]);
  return <group name={`climb-${kind}-spatial-grammar`} userData={{ language: kind === "mind" ? "repetition-into-space" : kind === "heart" ? "curved-intimate-shelter" : "open-protected-earth" }}>
    <Forms forms={layout.stones} name="climb-authored-boundary" kind={kind === "mind" ? "box" : "stone"} surface="stone" color={kind === "womb" ? "#71664f" : "#65706a"} />
    {bowl ? <mesh name="creation-soft-protected-earth" geometry={bowl} receiveShadow><TactileMaterial surface="earth" color="#847a61" roughness={.96} /></mesh> : null}
    {kind !== "mind" ? <BotanicalBatch kind="reeds" placements={layout.planting} mergeFoliage /> : null}
  </group>;
});
