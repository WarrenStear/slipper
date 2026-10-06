// Executable checks shared by the browser evidence fixture and its Node review.
// These inspect the live uploads; they do not infer correctness from source text.
export const FOREST_LIFECYCLE_SCENES = Object.freeze({ rabbit: 'enchanted.rabbit-hole',
  meadow: 'enchanted.friendship-meadow', previous: 'broken-floor.confession',
  fire: 'fire.boundary', river: 'river.wash', surrender: 'river.release-surrender' });

export function inspectForestMorphRows(image, capacity, targetCount = 8) {
  const problems = [], families = [];
  if (!image || image.width !== targetCount + 1 || image.height !== capacity
    || !(image.data instanceof Float32Array) || image.data.length !== capacity * (targetCount + 1)) {
    return { valid: false, problems: ['Morph texture does not cover the full constructor capacity'], families, rows: 0 };
  }
  for (let row = 0; row < capacity; row++) {
    const offset = row * image.width;
    let family = -1, selected = 0;
    if (image.data[offset] !== 0) problems.push(`Row ${row} has a nonzero or nonfinite base weight`);
    for (let target = 0; target < targetCount; target++) {
      const weight = image.data[offset + target + 1];
      if (!Number.isFinite(weight) || (weight !== 0 && weight !== 1)) problems.push(`Row ${row} target ${target} is not finite one-hot data`);
      if (weight === 1) { family = target; selected++; }
    }
    if (selected !== 1) problems.push(`Row ${row} selects ${selected} archetypes`);
    families.push(family);
  }
  return { valid: problems.length === 0, problems: problems.slice(0, 12), families, rows: capacity };
}

export function forestResourceCounts(sample) {
  return {
    geometries: sample.memory.geometries,
    textures: sample.memory.textures,
    programs: sample.programs,
    nativeTextures: sample.native.live,
    morphTargets: sample.native.kinds['forest-morph-target'] ?? 0,
    morphWeights: sample.native.kinds['forest-morph-weights'] ?? 0,
  };
}

export function resourcePlateauProblems(reference, current) {
  const before = forestResourceCounts(reference), after = forestResourceCounts(current);
  return Object.keys(before).filter(key => before[key] !== after[key])
    .map(key => `${key}: ${before[key]} -> ${after[key]}`);
}

export function forestLifecycleProblems(sample) {
  const problems = [];
  if (sample.glErrors.length) problems.push(`Native GL errors: ${sample.glErrors.join(', ')}`);
  if (sample.workerErrors.length) problems.push(`Worker errors: ${sample.workerErrors.join(', ')}`);
  if (sample.mounted) {
    if (sample.authorities.length !== 1 || sample.authorities[0]?.sceneId !== sample.sceneId
      || sample.authorities[0]?.quality !== sample.quality) problems.push('Canonical scene look authority has not reached the requested scene/quality');
    if (!sample.workersReady || !sample.terrainReady) problems.push('Current forest/terrain worker response is not uploaded');
    for (const name of ['trunks', 'crowns']) {
      const mesh = sample.forest[name];
      if (!mesh || mesh.capacity !== 243 || mesh.count < 1 || mesh.count > mesh.capacity || mesh.matrixVersion < 1 || !mesh.visible || !mesh.finite)
        problems.push(`${name} has an invalid capacity, population or matrix upload`);
      if (!mesh?.weights.valid || mesh?.weights.rows !== 243) problems.push(`${name} does not have 243 valid one-hot morph rows`);
      if (mesh?.morphTargets !== 8) problems.push(`${name} does not have all eight shape targets`);
    }
    if (sample.forest.trunks?.count !== sample.forest.crowns?.count) problems.push('Trunk/crown populations differ');
    if (sample.forest.pairProblems.length) problems.push(...sample.forest.pairProblems);
    if (sample.forest.rawTrunkHash !== sample.forest.uploadedTrunkHash) problems.push('Uploaded trunk matrices differ from the actual worker response');
    if (sample.forest.rawColorHash !== sample.forest.uploadedColorHash) problems.push('Uploaded trunk colors differ from the actual worker response');
    if (sample.route && (!sample.understory || sample.understory.count !== sample.expected.understoryCount
      || sample.understory.matrixVersion < 1 || !sample.understory.finite || !sample.understory.visible)) problems.push('Actual contextual path understory is missing, stale or invalid');
    if (sample.far?.batches !== 2 || sample.far?.counts.some(count => count !== sample.expected.farCount)
      || sample.far?.morphTextures !== 0 || sample.far?.morphTargets !== 0) problems.push('Far woodland does not retain its two ordinary populated batches');
    if ((sample.native.kinds['forest-morph-target'] ?? 0) !== 2
      || (sample.native.kinds['forest-morph-weights'] ?? 0) !== 2) problems.push('Canonical continuous forest has not uploaded exactly two target and two weight textures');
  } else {
    if (sample.liveWorkers !== 0) problems.push('World unmount left a worker alive');
    if (sample.authorities.length || sample.forest.trunks || sample.forest.crowns || sample.understory || sample.far)
      problems.push('World unmount left a forest or scene authority mounted');
    if ((sample.native.kinds['forest-morph-target'] ?? 0) || (sample.native.kinds['forest-morph-weights'] ?? 0))
      problems.push('World unmount left a native forest morph texture alive');
    if (sample.forestGeometries.some(geometry => !geometry.disposed)) problems.push('World unmount did not dispose an observed forest/terrain/understory/far geometry');
  }
  return problems;
}
