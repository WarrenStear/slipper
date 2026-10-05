import { memo, useEffect, useMemo } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { TactileMaterial } from "../storyEvents/TactileMaterial";
import { TimberAssembly } from "./ChapterArt";
import type { ConstructionPiece } from "./chapterArtGeometry";
import { windowLinenRailPieces } from "./windowConstruction";

/** Curtains hang from a visible rail. Opaque linen folds retain depth and stay
 * still; the central opening admits the chapter's existing exterior light. */
export const WindowLinen = memo(function WindowLinen({ width, height, color = "#c1b69d", railInJoinery = false }: {
  width: number; height: number; color?: string; railInJoinery?: boolean;
}) {
  const fabric = useMemo(() => {
    const panels = [-1, 1].map(side => {
      const geometry = new THREE.PlaneGeometry(width * .25, height + .28, 12, 14);
      const positions = geometry.getAttribute("position");
      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i), y = positions.getY(i);
        const down = .5 - y / (height + .28);
        positions.setXYZ(i, x + side * width * (.47 + Math.sin(down * Math.PI) * .045), y + .02,
          -.22 - Math.cos(x / width * 65) * .045 - down * .025);
      }
      geometry.computeVertexNormals(); return geometry;
    });
    const merged = mergeGeometries(panels, false)!;
    panels.forEach(panel => panel.dispose()); merged.computeBoundingBox(); merged.computeBoundingSphere();
    return merged;
  }, [width, height]);
  const rail = useMemo<ConstructionPiece[]>(() => windowLinenRailPieces(width, height), [width, height]);
  useEffect(() => () => fabric.dispose(), [fabric]);
  return <group name="rail-hung-window-linen">
    {railInJoinery ? null : <TimberAssembly pieces={rail} color="#66543e" />}
    <mesh geometry={fabric} castShadow receiveShadow><TactileMaterial surface="linen" color={color} roughness={.98} side={THREE.DoubleSide} /></mesh>
  </group>;
});
