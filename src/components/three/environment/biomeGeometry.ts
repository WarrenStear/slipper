import type { LandscapeBuffers, LandscapePoint } from "./landscapeGeography.ts";

const empty = (): LandscapeBuffers => ({ positions: [], normals: [], uvs: [], colors: [], indices: [] });
function triangle(data: LandscapeBuffers, a: LandscapePoint, b: LandscapePoint, c: LandscapePoint, shade = 1) {
  const i = data.positions.length / 3;
  shade = Math.max(0, Math.min(1, shade));
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const length = Math.hypot(nx, ny, nz);
  if (length < 1e-9) throw new Error("Degenerate biome geometry triangle");
  data.positions.push(...a, ...b, ...c); data.uvs.push(0, 0, 1, 0, .5, 1);
  for (let j = 0; j < 3; j++) { data.normals.push(nx / length, ny / length, nz / length); data.colors.push(shade * .96, shade, shade * .91); }
  data.indices.push(i, i + 1, i + 2);
}

/** Broken, layered boughs with negative space, not solid cone stacks. A 1.3m
 * horizontal envelope stays inside the ecology placement/culling budget. */
export function createEvergreenBuffers() {
  const bark = empty(), leaves = empty(), segments = 9;
  for (let i = 0; i < segments; i++) {
    const a = i / segments * Math.PI * 2, b = (i + 1) / segments * Math.PI * 2;
    const p: LandscapePoint = [Math.cos(a) * .16, 0, Math.sin(a) * .16];
    const q: LandscapePoint = [Math.cos(b) * .16, 0, Math.sin(b) * .16];
    const r: LandscapePoint = [.11 + Math.cos(a) * .025, 5.1, .04 + Math.sin(a) * .025];
    const s: LandscapePoint = [.11 + Math.cos(b) * .025, 5.1, .04 + Math.sin(b) * .025];
    triangle(bark, p, r, q, .88 + i % 3 * .04); triangle(bark, q, r, s, .88 + i % 3 * .04);
  }
  for (let tier = 0; tier < 7; tier++) {
    const height = 1.1 + tier * .57, reach = 1.08 - tier * .12;
    for (let j = 0; j < 7; j++) {
      const angle = j * Math.PI * 2 / 7 + tier * 1.07;
      const length = reach * (.84 + .13 * Math.sin(j * 4.1 + tier));
      const x = Math.cos(angle), z = Math.sin(angle), width = .18 + length * .18;
      const root: LandscapePoint = [.05, height + .26, .02];
      const tip: LandscapePoint = [x * length, height - .08, z * length];
      const left: LandscapePoint = [x * length * .49 - z * width, height + .06, z * length * .49 + x * width];
      const right: LandscapePoint = [x * length * .49 + z * width, height + .06, z * length * .49 - x * width];
      const ridge: LandscapePoint = [x * length * .54, height + .21, z * length * .54];
      const shade = .74 + tier * .026 + j % 3 * .035;
      triangle(leaves, root, left, ridge, shade); triangle(leaves, left, tip, ridge, shade);
      triangle(leaves, tip, right, ridge, shade + .035); triangle(leaves, right, root, ridge, shade + .035);
      // Small separated needle sprays cut a ragged edge into each bough.
      for (let k = 0; k < 2; k++) {
        const t = .48 + k * .22;
        const centre: LandscapePoint = [x * length * t, height + .08 - t * .1, z * length * t];
        const edge: LandscapePoint = [centre[0] - z * width * 1.05, centre[1] + .1, centre[2] + x * width * 1.05];
        const end: LandscapePoint = [centre[0] + x * .24 - z * width * .8, centre[1] - .08, centre[2] + z * .24 + x * width * .8];
        triangle(leaves, centre, end, edge, shade);
      }
    }
  }
  return { bark, leaves };
}

/** Curved grass blades keep individual silhouettes even at medium quality. */
export function createTussockBuffers() {
  const data = empty();
  for (let i = 0; i < 18; i++) {
    const angle = i * 2.399963, x = Math.cos(angle), z = Math.sin(angle);
    const height = .35 + i % 5 * .075, radius = (i % 3) * .065, width = .026 + i % 3 * .005;
    const base: LandscapePoint = [x * radius, 0, z * radius];
    const mid: LandscapePoint = [x * (radius + .12), height * .58, z * (radius + .12)];
    const tip: LandscapePoint = [x * (radius + .34), height, z * (radius + .34)];
    const a: LandscapePoint = [base[0] - z * width, 0, base[2] + x * width], b: LandscapePoint = [base[0] + z * width, 0, base[2] - x * width];
    const c: LandscapePoint = [mid[0] - z * width * .65, mid[1], mid[2] + x * width * .65], d: LandscapePoint = [mid[0] + z * width * .65, mid[1], mid[2] - x * width * .65];
    const shade = .77 + i % 5 * .045;
    triangle(data, a, c, b, shade); triangle(data, b, c, d, shade + .025); triangle(data, c, tip, d, shade + .05);
  }
  return data;
}

/** Restrained pale flowers, with dark stems baked into the same instance draw. */
export function createMeadowFlowerBuffers() {
  const data = empty();
  for (let flower = 0; flower < 3; flower++) {
    const angle = flower * 2.4, x = Math.cos(angle) * .16, z = Math.sin(angle) * .16, h = .42 + flower * .1;
    triangle(data, [x - .011, 0, z], [x + .012, 0, z], [x, h, z + .015], .38);
    triangle(data, [x, 0, z - .011], [x, h, z + .015], [x, 0, z + .011], .38);
    for (let petal = 0; petal < 5; petal++) {
      const a = petal * Math.PI * 2 / 5, c: LandscapePoint = [x, h, z];
      const l: LandscapePoint = [x + Math.cos(a - .38) * .1, h + .015, z + Math.sin(a - .38) * .1];
      const r: LandscapePoint = [x + Math.cos(a + .38) * .1, h + .015, z + Math.sin(a + .38) * .1];
      const tip: LandscapePoint = [x + Math.cos(a) * .145, h + .05, z + Math.sin(a) * .145];
      triangle(data, c, l, tip, .92); triangle(data, c, tip, r, .98);
    }
  }
  return data;
}
