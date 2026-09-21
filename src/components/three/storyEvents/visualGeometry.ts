/** Static presentation geometry. No story state, random input, or frame clock. */
export type SheetKind = "petal" | "feather" | "cloth" | "paper";
export type SheetData = { positions: number[]; uvs: number[]; indices: number[] };
export function makeStorySheet(kind: SheetKind, segments = 12): SheetData {
  const n = Math.max(4, Math.min(24, Number.isFinite(segments) ? Math.floor(segments) : 12));
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let row = 0; row <= n; row++) for (let column = 0; column <= n; column++) {
    const u = column / n, v = row / n, across = u - .5;
    let x: number, y: number, z: number;
    if (kind === "petal") {
      const width = .024 + .19 * Math.pow(Math.sin(Math.PI * v), .55);
      x = across * width;
      y = .115 * v - .047 * Math.sin(Math.PI * v) + across * across * .09;
      z = .16 * v + .035 * Math.sin(Math.PI * v);
    } else if (kind === "feather") {
      const width = .012 + .20 * Math.pow(Math.sin(Math.PI * v), .9);
      x = across * width * (u < .5 ? .78 : 1);
      y = .012 * Math.sin(Math.PI * v) + Math.abs(across) * .012;
      z = (v - .5) * .68;
    } else if (kind === "cloth") {
      x = across * .68;
      y = .02 * Math.sin(u * Math.PI * 5 + v * 1.8) + .01 * Math.sin(v * 8) - .028 * Math.pow(Math.abs(across) * 2, 3);
      z = (v - .5) * .45;
    } else {
      x = across * .62;
      y = .018 * Math.pow(u, 8) * Math.pow(v, 5) + .003 * Math.sin(v * Math.PI);
      z = (v - .5) * .43;
    }
    positions.push(x, y, z); uvs.push(u, v);
    if (row < n && column < n) {
      const a = row * (n + 1) + column, b = a + n + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return { positions, uvs, indices };
}

/** Flat paper facets form a folded bird; not a substitute for the Swan actor. */
export function paperBirdPositions(): number[] {
  const points = {
    tail: [-.29, .025, 0], breast: [.17, .035, 0], ridge: [0, .13, 0],
    left: [-.10, .25, -.32], right: [-.10, .25, .32],
    leftFold: [.035, .055, -.09], rightFold: [.035, .055, .09],
    neck: [.17, .30, 0], beak: [.30, .255, 0],
  };
  type Point = keyof typeof points;
  const faces: Point[][] = [
    ["tail", "leftFold", "ridge"], ["tail", "ridge", "rightFold"],
    ["ridge", "leftFold", "left"], ["ridge", "right", "rightFold"],
    ["leftFold", "breast", "ridge"], ["ridge", "breast", "rightFold"],
    ["breast", "neck", "ridge"], ["ridge", "neck", "beak"],
  ];
  return faces.flatMap(face => face.flatMap(point => points[point]));
}
