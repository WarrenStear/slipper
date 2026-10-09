import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from "three";

const PAST = [[0, 0, -6], [-3.5, 0, -1], [-6.5, 0, 5], [-9.5, 0, 9], [-13, 0, 5], [-11, 0, -1]];
const FUTURE = [[0, 0, -6], [3.2, 0, -1], [6.5, 0, 8], [10, 0, 19], [13, 0, 34]];
const SIDES = [-1, -.7, 0, .7, 1];

/** Worn earth merges into the clearing at its margins, with no decal or glow.
 * The authored centreline and walkable height are unchanged. */
export function createForkPath(future: boolean, color = future ? "#525b4d" : "#74634c") {
  const curve = new CatmullRomCurve3((future ? FUTURE : PAST).map(p => new Vector3(...p)));
  const positions: number[] = [], uv: number[] = [], indices: number[] = [], colors: number[] = [];
  const earth = new Color("#26241b"), worn = new Color(color), tint = new Color();
  for (let i = 0; i <= 48; i++) {
    const t = i / 48, p = curve.getPoint(t), tangent = curve.getTangent(t);
    const width = (future ? 1.12 * (1 - t * .92) : 1.38) * (1 + Math.sin(i * 1.9) * .08);
    for (let j = 0; j < SIDES.length; j++) {
      const side = SIDES[j];
      positions.push(p.x + tangent.z * width * side, .017, p.z - tangent.x * width * side);
      uv.push((side + 1) / 2, t * 16);
      const wear = Math.abs(side) === 1 ? 0 : (.78 + Math.sin(i * .81 + side) * .08) * (future ? 1 - t * .64 : 1);
      tint.copy(earth).lerp(worn, wear).toArray(colors, colors.length);
      if (i < 48 && j < SIDES.length - 1) {
        const k = i * SIDES.length + j;
        indices.push(k, k + 5, k + 1, k + 1, k + 5, k + 6);
      }
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uv, 2));
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  geometry.computeBoundingBox(); geometry.computeBoundingSphere();
  return geometry;
}
