import { BufferAttribute, BufferGeometry, Float32BufferAttribute } from "three";

/** Consume one privately owned weathered panel. Position/normal values and
 * triangle order stay exact; only projection seams/caps acquire distinct UVs. */
export function projectPlasterMetreUvs(source: BufferGeometry): BufferGeometry {
  const position = source.getAttribute("position"), sourceIndex = source.getIndex();
  if (!position || position.itemSize !== 3 || !sourceIndex || sourceIndex.count % 3) throw new Error("Plaster projection requires indexed positions.");
  const supplied = Object.entries(source.attributes).filter(([name]) => name !== "uv");
  if (supplied.some(([, attribute]) => !(attribute instanceof BufferAttribute) || !(attribute.array instanceof Float32Array))) throw new Error("Plaster construction uses separate Float32 attributes.");
  const attributes = supplied as [string, BufferAttribute][];
  const values = Object.fromEntries(attributes.map(([name]) => [name, [] as number[]]));
  const uv: number[] = [], indices: number[] = [], seams = new Map<string, number>();
  for (let triangle = 0; triangle < sourceIndex.count; triangle += 3) {
    const a = sourceIndex.getX(triangle), b = sourceIndex.getX(triangle + 1), c = sourceIndex.getX(triangle + 2);
    const ux = position.getX(b) - position.getX(a), uy = position.getY(b) - position.getY(a), uz = position.getZ(b) - position.getZ(a);
    const vx = position.getX(c) - position.getX(a), vy = position.getY(c) - position.getY(a), vz = position.getZ(c) - position.getZ(a);
    const normal = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
    const magnitude = normal.map(Math.abs), axis = magnitude.indexOf(Math.max(...magnitude)), sign = normal[axis] < 0 ? -1 : 1;
    for (const vertex of [a, b, c]) {
      const key = `${axis}:${sign}:${vertex}`;
      let target = seams.get(key);
      if (target === undefined) {
        target = uv.length / 2; seams.set(key, target);
        for (const [name, attribute] of attributes) {
          for (let component = 0; component < attribute.itemSize; component++) values[name].push(attribute.array[vertex * attribute.itemSize + component]);
        }
        const x = position.getX(vertex), y = position.getY(vertex), z = position.getZ(vertex);
        // Metres, with outward-oriented tangent bases. Projection changes have
        // duplicated vertices, preserving the source's smoothed lighting normals.
        if (axis === 0) uv.push(-z * sign, y);
        else if (axis === 1) uv.push(x, -z * sign);
        else uv.push(x * sign, y);
      }
      indices.push(target);
    }
  }
  const result = new BufferGeometry();
  for (const [name, attribute] of attributes) result.setAttribute(name, new BufferAttribute(new Float32Array(values[name]), attribute.itemSize, attribute.normalized));
  result.setAttribute("uv", new Float32BufferAttribute(uv, 2)); result.setIndex(indices);
  result.boundingBox = source.boundingBox?.clone() ?? null; result.boundingSphere = source.boundingSphere?.clone() ?? null;
  result.userData = { ...source.userData, plasterCoordinates: "metre-planar-with-projection-seams" };
  source.dispose(); return result;
}

/** Strict receiving-mesh review guard; it does not replace the broad shipping
 * map guard or reject existing bark caps without a separate migration. */
export function hasNondegeneratePlasterUvs(geometry: BufferGeometry): boolean {
  const position = geometry.getAttribute("position"), uv = geometry.getAttribute("uv"), index = geometry.getIndex();
  if (!position || !uv || uv.itemSize !== 2 || uv.count !== position.count || !index || index.count % 3) return false;
  for (let i = 0; i < uv.count; i++) if (!Number.isFinite(uv.getX(i)) || !Number.isFinite(uv.getY(i))) return false;
  let physicalTriangles = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = index.getX(i), b = index.getX(i + 1), c = index.getX(i + 2);
    const ux = position.getX(b) - position.getX(a), uy = position.getY(b) - position.getY(a), uz = position.getZ(b) - position.getZ(a);
    const vx = position.getX(c) - position.getX(a), vy = position.getY(c) - position.getY(a), vz = position.getZ(c) - position.getZ(a);
    const physicalArea = Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx);
    if (!Number.isFinite(physicalArea)) return false;
    if (!physicalArea) continue;
    physicalTriangles++;
    const uvArea = Math.abs((uv.getX(b)-uv.getX(a))*(uv.getY(c)-uv.getY(a))-(uv.getX(c)-uv.getX(a))*(uv.getY(b)-uv.getY(a)));
    if (!(uvArea / physicalArea > 1e-10)) return false;
  }
  return physicalTriangles > 0;
}
