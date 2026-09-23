import { memo, useMemo } from "react";
import { Forms } from "./EnvironmentDressing";
import type { DressingForm } from "./chapterEnvironment";
import { BotanicalBatch, type BotanicalPlacement } from "../environmentArt/EnvironmentArt";

/** Decoration stays outside the authored walk and interaction targets. */
export const ClimbLandscape = memo(function ClimbLandscape({ kind, released }: { kind: "mind" | "heart" | "womb"; released: boolean }) {
  const layout = useMemo(() => {
    const stones: DressingForm[] = [], planting: BotanicalPlacement[] = [];
    if (kind === "mind") {
      for (let i = 0; i < 8; i++) for (const side of [-1, 1]) {
        if (released && i < 5) continue;
        const height = 3 + (i % 3) * 1.4;
        stones.push({ position: [side * (5.7 + i * .18), height / 2, -6 + i * 2.8], scale: [.75, height, 1.3], rotation: [0, side * .14, side * -.08] });
      }
    } else {
      for (let i = 0; i < 17; i++) {
        const angle = .1 + i / 16 * Math.PI * .94;
        const x = Math.cos(angle) * (kind === "heart" ? 8.5 : 10), z = 5 + Math.sin(angle) * 6;
        stones.push({ position: [x, .4, z], scale: [1.2, kind === "heart" ? .8 : .55, 1.1], rotation: [.05, angle, -.04] });
        if (kind === "heart") planting.push({ position: [x, .35, z + .5], scale: .9, rotation: [0, angle, 0] });
      }
    }
    return { stones, planting };
  }, [kind, released]);
  return <group name={`climb-${kind}-spatial-grammar`} userData={{ language: kind === "mind" ? "repetition-into-space" : kind === "heart" ? "curved-intimate-shelter" : "open-protected-earth" }}>
    <Forms forms={layout.stones} name="climb-authored-boundary" kind={kind === "mind" ? "box" : "stone"} surface="stone" color={kind === "womb" ? "#71664f" : "#65706a"} />
    {kind === "heart" ? <BotanicalBatch kind="reeds" placements={layout.planting} mergeFoliage /> : null}
  </group>;
});
