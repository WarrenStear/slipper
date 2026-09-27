/** Independent acceptance checks for the rendered biome fixture, not a mock renderer. */
export const BIOME_REVIEW_CASES = Object.freeze([
  { sceneId: 'enchanted.rabbit-hole', family: 'woodland', river: true, flowers: false },
  { sceneId: 'nest.two-hands', family: 'meadow', river: false, flowers: true },
  { sceneId: 'wolf-swan.convergence', family: 'riverbank', river: false, flowers: false },
  { sceneId: 'fork.weighing', family: 'upland', river: true, flowers: false },
  { sceneId: 'climbs.arrival', family: 'highland', river: false, flowers: false },
  { sceneId: 'crowned.home', family: 'home', river: true, flowers: true },
  { sceneId: 'blue-moon.sanctuary', family: 'sanctuary', river: false, flowers: false },
].map(Object.freeze));
export const BIOME_REVIEW_VIEWPORTS = Object.freeze([
  Object.freeze({ width: 1440, height: 900 }), Object.freeze({ width: 390, height: 844 }),
]);
const qualities = ['low', 'medium', 'high', 'cinematic'];
const evergreenBatches = ['wind-shaped-evergreen-trunks', 'layered-evergreen-boughs'];
const grassBatch = 'clustered-hillside-tussocks', flowerBatch = 'meadow-wildflower-drifts';
const ecologyNames = [...evergreenBatches, grassBatch, flowerBatch];
const requiredConfig = ['sceneId', 'quality', 'reducedEffects', 'reducedMotion'];

export function expectedBiomeCounts(config) {
  const scene = BIOME_REVIEW_CASES.find(item => item.sceneId === config?.sceneId);
  const tier = qualities.indexOf(config?.quality);
  if (!scene || tier < 0 || typeof config.reducedEffects !== 'boolean' || typeof config.reducedMotion !== 'boolean') {
    throw new Error('Unknown or malformed biome review configuration');
  }
  const level = config.reducedEffects ? 0 : tier;
  const active = scene.family !== 'sanctuary';
  return {
    scene,
    trees: active ? [8, 14, 22, 30][level] : 0,
    evergreens: active ? [0, 2, 6, 10][level] : 0,
    grass: active ? [0, 20, 44, 72][level] : 0,
    flowers: active && scene.flowers ? [0, 6, 14, 24][level] : 0,
  };
}

export function assertBiomeSnapshot(snapshot, config) {
  const expected = expectedBiomeCounts(config), failures = [];
  const require = (condition, message) => { if (!condition) failures.push(message); };
  require(snapshot && typeof snapshot === 'object', 'Rendered snapshot is missing');
  if (!snapshot || typeof snapshot !== 'object') throw new Error(failures.join('; '));
  for (const key of requiredConfig) require(snapshot.config?.[key] === config[key], `Stale ${key} state`);
  require(snapshot.webgl2 === true, 'A real WebGL2 context is required');
  require(snapshot.contextLost === false, 'WebGL context was lost or not checked');
  require(Number.isInteger(snapshot.frames) && snapshot.frames >= 30, 'Insufficient settled rendered frames');
  require(Number.isInteger(snapshot.calls) && snapshot.calls > 0 && snapshot.calls <= 40, 'Empty or excessive render calls');
  require(Number.isInteger(snapshot.triangles) && snapshot.triangles > 0 && snapshot.triangles <= 100000, 'Empty or excessive geometry render');
  require(Number.isInteger(snapshot.pixelColors) && snapshot.pixelColors >= 3, 'Canvas has no demonstrated image variation');
  require(Array.isArray(snapshot.shaderErrors) && snapshot.shaderErrors.length === 0, 'Shader compiler reported errors');
  require(snapshot.glError === 0, 'WebGL error state is not clean');
  require(Array.isArray(snapshot.batches), 'Instance batch evidence is missing');
  require(Array.isArray(snapshot.drawn), 'Drawn-object evidence is missing');
  const batches = new Map((snapshot.batches ?? []).map(batch => [batch.name, batch]));
  const checkBatch = (name, count) => {
    const batch = batches.get(name);
    if (!count && ecologyNames.includes(name)) {
      require(!batch, `${name} should not be allocated`);
      return;
    }
    require(batch?.count === count && batch?.visible === (count > 0), `${name} has the wrong active count`);
    require(batch?.finite === true, `${name} has non-finite instance transforms`);
    require(batch?.bounded === true, `${name} has invalid culling bounds`);
    require(typeof batch?.geometry === 'string' && batch.geometry.length > 0, `${name} geometry identity is missing`);
    require(Number.isInteger(batch?.matrixVersion), `${name} upload evidence is missing`);
    require(typeof batch?.matrixHash === 'string' && /^[a-f0-9]{1,8}$/.test(batch.matrixHash), `${name} matrix hash is missing`);
    if (count) require(snapshot.drawn?.includes(name), `${name} was not actually rendered`);
  };
  if (expected.scene.family !== 'sanctuary') {
    require(typeof snapshot.terrain === 'string' && snapshot.terrain.length > 0, 'Landscape terrain was not mounted');
    require(snapshot.drawn?.includes('rolling-hills-and-carved-riverbanks'), 'Landscape terrain was not drawn');
    checkBatch('hillside-tree-trunks', expected.trees);
    checkBatch('hillside-tree-canopies', expected.trees);
  } else require(snapshot.terrain === null, 'Sanctuary unexpectedly received hillside terrain');
  for (const name of evergreenBatches) checkBatch(name, expected.evergreens);
  checkBatch(grassBatch, expected.grass); checkBatch(flowerBatch, expected.flowers);
  const waterExpected = expected.scene.river || expected.scene.family === 'sanctuary';
  require(snapshot.water?.length === (waterExpected ? 1 : 0), 'Unexpected water surface count');
  if (waterExpected) {
    const water = snapshot.water?.[0];
    require(water?.banks === (expected.scene.river ? 1 : 0), 'River bank mode leaked or was not applied');
    require(Number.isFinite(water?.time), 'Water uniforms were not captured from a compiled shader');
    require(snapshot.drawn?.includes(expected.scene.river ? 'directional-river-water' : 'still-reflective-water'), 'Water was not actually drawn');
    if (config.reducedEffects || config.reducedMotion) require(water?.time === 0, 'Water kept moving under reduced settings');
  }
  if (failures.length) throw new Error(failures.join('; '));
  return snapshot;
}

/** Settings may replace rich legacy leaves, not terrain or the new fixed ecology. */
export function assertQualityReuse(before, after) {
  if (before.config.sceneId !== after.config.sceneId) throw new Error('Cannot compare different scenes');
  if (before.terrain !== after.terrain) throw new Error('Quality change rebuilt terrain/collision geometry');
  const previous = new Map(before.batches.map(batch => [batch.name, batch]));
  for (const batch of after.batches) {
    const old = previous.get(batch.name);
    if (!old || !ecologyNames.includes(batch.name)) continue;
    if (old.geometry !== batch.geometry || old.matrixVersion !== batch.matrixVersion || old.matrixHash !== batch.matrixHash) {
      throw new Error(`Quality change rebuilt or uploaded ${batch.name}`);
    }
  }
}

export function assertFrozenMotion(before, after) {
  if (!after.config.reducedEffects && !after.config.reducedMotion) throw new Error('Freeze test requires a reduced setting');
  if (after.revision !== before.revision || after.frames < before.frames + 15) throw new Error('Freeze test needs fresh frames of the same state');
  for (const channel of ['vegetation', 'cloth', 'water', 'particles', 'flame']) {
    if (!Number.isFinite(before.time?.[channel]) || before.time[channel] !== after.time?.[channel]) {
      throw new Error(`${channel} clock did not stay frozen`);
    }
  }
}

/** Missing captures must never produce an all-green report. */
export function assertCompleteBiomeReview(report) {
  if (report.check?.status !== 'passed') throw new Error('Full repository check has not passed');
  if (!Array.isArray(report.failures) || report.failures.length) throw new Error('The review contains failures or lacks diagnostics');
  const required = ['high', 'medium', 'cinematic', 'effects-off', 'motion-off', 'low', 'restored'];
  for (const viewport of BIOME_REVIEW_VIEWPORTS) {
    if (!report.entries?.some(entry => entry.width === viewport.width && entry.passed === true)) throw new Error('Production entry interaction is missing');
    for (const scene of BIOME_REVIEW_CASES) for (const state of required) {
      const captures = report.captures?.filter(c => c.width === viewport.width && c.sceneId === scene.sceneId && c.state === state && c.passed === true) ?? [];
      if (captures.length !== 1 || !captures[0].screenshot) throw new Error(`Missing or duplicate ${scene.family}/${state}/${viewport.width} evidence`);
    }
  }
}
