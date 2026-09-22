/** A stamp is committed only when its worker can receive the build request. */
export type ForestBuildStamp = {
  cellX: number; cellZ: number; depth: number; pressure: number;
  entryCount: number; quality: string; forestDensity: number; pathClarity: number;
};

/** No per-frame allocation; an unavailable worker leaves the pending cell intact. */
export function claimForestBuild(
  workerReady: boolean, last: ForestBuildStamp,
  cellX: number, cellZ: number, depth: number, pressure: number,
  entryCount: number, quality: string, forestDensity: number, pathClarity: number,
) {
  if (!workerReady) return false;
  if (last.cellX === cellX && last.cellZ === cellZ && last.depth === depth &&
    last.pressure === pressure && last.entryCount === entryCount && last.quality === quality &&
    last.forestDensity === forestDensity && last.pathClarity === pathClarity) return false;
  last.cellX = cellX; last.cellZ = cellZ; last.depth = depth; last.pressure = pressure;
  last.entryCount = entryCount; last.quality = quality;
  last.forestDensity = forestDensity; last.pathClarity = pathClarity;
  return true;
}
