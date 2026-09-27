/** Pure authored mesh data, tested without a renderer. No runtime assets or RNG. */
export type GrowthBuffers = { positions: number[]; normals: number[]; colors: number[]; uvs: number[]; indices: number[] };
type Point = [number, number, number];
type ProfilePoint = [radius: number, height: number];
const linear = (value: number) => value <= .04045 ? value / 12.92 : Math.pow((value + .055) / 1.055, 2.4);
const rgb = (r: number, g: number, b: number): Point => [linear(r / 255), linear(g / 255), linear(b / 255)];
const STEM = rgb(193, 180, 151), CAP = rgb(139, 94, 58), RIM = rgb(199, 173, 126), GILLS = rgb(142, 128, 101);

function lathe(data: GrowthBuffers, profile: readonly ProfilePoint[], centre: Point, segments: number, palette: readonly Point[]) {
  const start = data.positions.length / 3;
  profile.forEach(([radius, height], ring) => {
    const previous = profile[Math.max(0, ring - 1)], next = profile[Math.min(profile.length - 1, ring + 1)];
    const dr = next[0] - previous[0], dy = next[1] - previous[1];
    const length = Math.max(1e-6, Math.hypot(dr, dy));
    for (let j = 0; j < segments; j++) {
      const angle = j / segments * Math.PI * 2, cosine = Math.cos(angle), sine = Math.sin(angle);
      data.positions.push(centre[0] + radius * cosine, centre[1] + height, centre[2] + radius * sine);
      data.normals.push(radius === 0 ? 0 : -dy / length * cosine, radius === 0 ? (ring === 0 ? 1 : -1) : dr / length, radius === 0 ? 0 : -dy / length * sine);
      const tint = palette[Math.min(ring, palette.length - 1)], variation = .96 + .04 * Math.cos(angle * 5 + ring);
      data.colors.push(tint[0] * variation, tint[1] * variation, tint[2] * variation);
      data.uvs.push(j / segments, ring / (profile.length - 1));
    }
  });
  for (let ring = 0; ring < profile.length - 1; ring++) for (let j = 0; j < segments; j++) {
    const next = (j + 1) % segments;
    const a = start + ring * segments + j, b = start + ring * segments + next;
    const c = a + segments, d = b + segments;
    if (profile[ring][0] === 0) data.indices.push(a, d, c);
    else if (profile[ring + 1][0] === 0) data.indices.push(a, b, c);
    else data.indices.push(a, b, c, b, d, c);
  }
}

/** Three differently sized, opaque cap-and-stem mushrooms in one coloured mesh. */
export function createMushroomClusterBuffers(rich = false): GrowthBuffers {
  const data: GrowthBuffers = { positions: [], normals: [], colors: [], uvs: [], indices: [] };
  const specimens = [
    { x: -.24, z: -.03, height: .32, radius: .19 },
    { x: .17, z: .12, height: .22, radius: .14 },
    { x: .04, z: -.22, height: .15, radius: .105 },
  ];
  for (const { x, z, height, radius } of specimens) {
    const stemRadius = radius * .19;
    lathe(data, [[0, height], [stemRadius * .8, height], [stemRadius, .035], [stemRadius * 1.15, 0], [0, 0]], [x, 0, z], 8, [STEM]);
    const cap = radius * .68;
    lathe(data, [[0, cap], [radius * .46, cap * .86], [radius * .86, cap * .43], [radius, 0], [radius * .82, -cap * .16], [0, -cap * .1]], [x, height, z], rich ? 16 : 12, [CAP, CAP, CAP, RIM, GILLS, GILLS]);
  }
  return data;
}
