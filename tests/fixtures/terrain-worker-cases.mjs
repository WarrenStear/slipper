const biomes = [
  ['firstWood', 'The First Wood', '#344432'],
  ['mirror', 'The Mirror Clearing', '#42545f'],
  ['thorned', 'The Thorned House', '#403839'],
  ['archive', 'The Blue Moon Archive', '#3d465e'],
  ['fireRiver', 'The Fire and River', '#584238'],
  ['crowned', 'The Crowned Return', '#516149'],
];

const morphs = [
  { explorationDepth: 0, memoryPressure: 0, cell: [-2, 1] },
  { explorationDepth: 0.3, memoryPressure: 0.2, cell: [0, 0] },
  { explorationDepth: 0.95, memoryPressure: 0.85, cell: [2, -1] },
];

// Curves, clearing footprints, and cells deliberately vary independently of
// biome so parity covers terrain morphs, path masks, and elevated sanctuaries.
export const terrainWorkerCases = biomes.flatMap(([biome, chapter, groundColor], biomeIndex) =>
  morphs.map(({ explorationDepth, memoryPressure, cell }, morphIndex) => {
    const x = cell[0] * 16;
    const z = cell[1] * 16;
    const elevated = biome === 'crowned';
    const source = [x - 38, z - 20];
    const target = [x + 26, z + 30];
    const controlA = [x - 10, z + 34];
    const controlB = [x + 14, z - 27];
    return {
      name: `${biome}-cell-${cell.join(',')}-morph-${morphIndex}`,
      config: {
        terrainSize: 192,
        terrainSegments: 24,
        terrainBaseY: -1.255,
        clearingSafeRadius: 7.2,
        corridorBaseWidth: 5.2,
        crownedRampWidth: 12,
        explorationDepth,
        memoryPressure,
        groundColor,
        clearings: [
          { id: 'arrival', chapter, biome, position: [source[0], 0, source[1]], elevated: false },
          { id: 'destination', chapter, biome, position: [target[0], elevated ? 6 : 0, target[1]], radius: 8 + biomeIndex },
        ],
        paths: [{
          source, target, controlA, controlB,
          curveSeed: 0.17 + biomeIndex * 0.11 + morphIndex * 0.07,
          curveLength: 104,
          sourceChapter: chapter,
          targetChapter: chapter,
          sourceY: 0,
          targetY: elevated ? 6 : 0,
          crownRamp: elevated,
          minX: x - 62,
          maxX: x + 50,
          minZ: z - 51,
          maxZ: z + 58,
        }],
      },
    };
  }),
);

export function terrainCasePoints(config) {
  const points = [];
  const half = config.terrainSize * 0.5;
  const step = config.terrainSize / config.terrainSegments;
  for (let iz = 0; iz <= config.terrainSegments; iz += 1) {
    for (let ix = 0; ix <= config.terrainSegments; ix += 1) {
      points.push([ix * step - half, iz * step - half]);
    }
  }
  return points;
}
