import type { BufferGeometry } from "three";

/** CPU-only templates. Every caller owns an independent clone; cached geometry
 * is never attached to a mesh or uploaded. Both entry count and bytes are capped. */
export function createGeometryTemplateCache(maxEntries = 64, maxBytes = 8 * 1024 * 1024) {
  const templates = new Map<string, { geometry: BufferGeometry; bytes: number }>();
  let bytes = 0;
  const removeOldest = () => {
    const key = templates.keys().next().value;
    if (key === undefined) return;
    const entry = templates.get(key)!;
    templates.delete(key); bytes -= entry.bytes; entry.geometry.dispose();
  };
  return {
    get(key: string, build: () => BufferGeometry) {
      const cached = templates.get(key);
      if (cached) {
        templates.delete(key); templates.set(key, cached);
        return cached.geometry.clone();
      }
      const geometry = build();
      const arrays = new Set<ArrayBufferLike>();
      for (const attribute of [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat()]) {
        arrays.add("data" in attribute ? attribute.data.array.buffer : attribute.array.buffer);
      }
      if (geometry.index) arrays.add(geometry.index.array.buffer);
      const size = [...arrays].reduce((sum, buffer) => sum + buffer.byteLength, 0) + key.length * 2;
      if (size <= maxBytes && maxEntries > 0) {
        while (templates.size && (templates.size >= maxEntries || bytes + size > maxBytes)) removeOldest();
        templates.set(key, { geometry: geometry.clone(), bytes: size }); bytes += size;
      }
      return geometry;
    },
    clear() { while (templates.size) removeOldest(); },
    get stats() { return { entries: templates.size, bytes }; },
  };
}
