type TriangleSurface = { positions: ArrayLike<number>; indices: ArrayLike<number> };
type Face = { a: number; b: number; c: number; denominator: number; minX: number; maxX: number; minZ: number; maxZ: number };
const EPSILON = 1e-7;
const COLUMNS = 64, ROWS = 40;
const cell = (value: number, min: number, span: number, count: number) =>
  Math.max(0, Math.min(count - 1, Math.floor((value - min) / span * count)));

/** Build once for immutable terrain buffers. Broad-phase cells only select
 * candidates; grounding still uses the original triangles and barycentric math.
 * Candidate order is stable, including shared edges and overlapping faces.
 * No global cache, Three.js dependency, geometry mutation or per-query allocation.
 */
export function createLandscapeHeightIndex(data: TriangleSurface) {
  const p = data.positions, faces: Face[] = [];
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i + 2 < data.indices.length; i += 3) {
    const ia = data.indices[i], ib = data.indices[i + 1], ic = data.indices[i + 2];
    if (![ia, ib, ic].every(n => Number.isInteger(n) && n >= 0 && n * 3 + 2 < p.length)) continue;
    const a = ia * 3, b = ib * 3, c = ic * 3;
    if (![p[a], p[a + 1], p[a + 2], p[b], p[b + 1], p[b + 2], p[c], p[c + 1], p[c + 2]].every(Number.isFinite)) continue;
    const denominator = (p[b + 2] - p[c + 2]) * (p[a] - p[c]) + (p[c] - p[b]) * (p[a + 2] - p[c + 2]);
    if (!Number.isFinite(denominator) || denominator === 0) continue;
    const face = {
      a, b, c, denominator,
      minX: Math.min(p[a], p[b], p[c]) - EPSILON, maxX: Math.max(p[a], p[b], p[c]) + EPSILON,
      minZ: Math.min(p[a + 2], p[b + 2], p[c + 2]) - EPSILON, maxZ: Math.max(p[a + 2], p[b + 2], p[c + 2]) + EPSILON,
    };
    faces.push(face);
    minX = Math.min(minX, face.minX); maxX = Math.max(maxX, face.maxX);
    minZ = Math.min(minZ, face.minZ); maxZ = Math.max(maxZ, face.maxZ);
  }
  const spanX = maxX - minX, spanZ = maxZ - minZ;
  const valid = faces.length > 0 && Number.isFinite(spanX) && Number.isFinite(spanZ) && spanX > 0 && spanZ > 0;
  // Small fixtures need no large grid. The production index has a fixed ceiling.
  const columns = valid ? Math.min(COLUMNS, faces.length) : 1;
  const rows = valid ? Math.min(ROWS, faces.length) : 1;
  const bins: number[][] = Array.from({ length: columns * rows }, () => []);
  let references = 0, maxCandidates = 0;
  if (valid) faces.forEach((face, index) => {
    const x0 = cell(face.minX, minX, spanX, columns), x1 = cell(face.maxX, minX, spanX, columns);
    const z0 = cell(face.minZ, minZ, spanZ, rows), z1 = cell(face.maxZ, minZ, spanZ, rows);
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
      const bin = bins[z * columns + x];
      bin.push(index); references++; maxCandidates = Math.max(maxCandidates, bin.length);
    }
  });
  return {
    stats: Object.freeze({ triangles: faces.length, cells: bins.length, references, maxCandidates }),
    sampleHeight(x: number, z: number): number | null {
      if (!valid || !Number.isFinite(x) || !Number.isFinite(z) || x < minX || x > maxX || z < minZ || z > maxZ) return null;
      const candidates = bins[cell(z, minZ, spanZ, rows) * columns + cell(x, minX, spanX, columns)];
      for (let i = 0; i < candidates.length; i++) {
        const face = faces[candidates[i]], { a, b, c } = face;
        if (x < face.minX || x > face.maxX || z < face.minZ || z > face.maxZ) continue;
        const u = ((p[b + 2] - p[c + 2]) * (x - p[c]) + (p[c] - p[b]) * (z - p[c + 2])) / face.denominator;
        const v = ((p[c + 2] - p[a + 2]) * (x - p[c]) + (p[a] - p[c]) * (z - p[c + 2])) / face.denominator;
        if (u >= -EPSILON && v >= -EPSILON && u + v <= 1 + EPSILON) return u * p[a + 1] + v * p[b + 1] + (1 - u - v) * p[c + 1];
      }
      return null;
    },
  };
}
