import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  createTerrainPointSampler,
  sampleTerrainElevation,
  terrainWalkableInfluenceAtPoint,
} from '../src/lib/terrainModel.ts';
import { generateTerrain } from '../src/workers/forestWorker.ts';
import { terrainCasePoints, terrainWorkerCases } from './fixtures/terrain-worker-cases.mjs';

const baseline = JSON.parse(readFileSync(new URL('./fixtures/terrain-worker-baseline.json', import.meta.url), 'utf8'));
const hash = array => createHash('sha256')
  .update(new Uint8Array(array.buffer, array.byteOffset, array.byteLength))
  .digest('hex');

test('prepared terrain sampling preserves canonical heights and reuses the supplied result', () => {
  const result = { elevation: NaN, walkableInfluence: NaN };
  for (const { name, config } of terrainWorkerCases) {
    const sample = createTerrainPointSampler(config);
    const points = terrainCasePoints(config);
    const canonical = new Float64Array(points.length * 2);
    for (const [index, [x, z]] of points.entries()) {
      assert.equal(sample(x, z, result), result, 'Each vertex must reuse the batch result');
      assert.equal(result.elevation, sampleTerrainElevation(x, z, config), `${name} elevation at ${x},${z}`);
      assert.equal(result.walkableInfluence, terrainWalkableInfluenceAtPoint(x, z, config), `${name} path mask at ${x},${z}`);
      canonical[index * 2] = result.elevation;
      canonical[index * 2 + 1] = result.walkableInfluence;
    }
    assert.equal(hash(canonical), baseline.cases[name].samples, `${name}: public height and path samples changed`);
  }
});

test('terrain worker matches committed positions, colors, and habitat bytes across all six biomes', () => {
  assert.equal(terrainWorkerCases.length, 18);
  for (const [index, { name, config }] of terrainWorkerCases.entries()) {
    const terrain = generateTerrain({ type: 'GENERATE_TERRAIN', requestId: index + 1, config });
    assert.equal(terrain.type, 'TERRAIN_READY');
    assert.equal(terrain.requestId, index + 1);
    for (const key of ['positions', 'colors', 'habitat']) {
      assert.equal(hash(terrain[key]), baseline.cases[name][key], `${name}: ${key} changed from ${baseline.revision}`);
    }
  }
});
