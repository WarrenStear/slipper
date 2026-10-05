import type { ConstructionPiece } from "./chapterArtGeometry.ts";

/** The same physical rail can share the surrounding window's timber draw. */
export function windowLinenRailPieces(width: number, height: number): ConstructionPiece[] {
  return [
    { position: [0, height / 2 + .18, -.21], size: [width * 1.3, .045, .055] },
    ...[-1, 1].map(side => ({
      position: [side * width * .58, height / 2 + .12, -.11] as [number, number, number],
      size: [.065, .15, .27] as [number, number, number],
    })),
  ];
}

export function windowJoineryPieces(width: number, height: number, color: string, linenRail = false): ConstructionPiece[] {
  const pieces: ConstructionPiece[] = [
    ...[-1, 1].map(side => ({ position: [side * (width / 2 + .055), 0, -.03] as [number, number, number], size: [.11, height + .22, .18] as [number, number, number] })),
    ...[-1, 1].map(side => ({ position: [0, side * (height / 2 + .055), -.03] as [number, number, number], size: [width + .11, .11, .18] as [number, number, number] })),
    { position: [0, 0, -.12], size: [.065, height, .08] },
    { position: [0, .12, -.12], size: [width, .055, .08] },
    { position: [0, -height / 2 - .08, -.08], size: [width + .34, .12, .35] },
  ];
  if (!linenRail) return pieces;
  return [
    ...pieces.map(piece => ({ ...piece, color })),
    ...windowLinenRailPieces(width, height).map(piece => ({ ...piece, color: "#66543e" })),
  ];
}
