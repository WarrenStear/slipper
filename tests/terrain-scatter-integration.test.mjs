import assert from 'node:assert/strict';
import test from 'node:test';
import { createLandscapeEcology, ecologyRadius } from '../src/components/three/environment/landscapeEcology.ts';
import { LANDSCAPE_SCENES, landscapeForScene, createLandscapeTerrain, createLandscapeObjects, heightOnLandscape, landscapeRiverCentre, landscapeRiverWidth } from '../src/components/three/environment/landscapeGeography.ts';
import { ENVIRONMENT_THEMES, BIOME_ECOLOGY_CAPACITY, biomeEcologyBudget } from '../src/components/three/environment/environmentThemes.ts';
import { MAX_SCATTER_TILT } from '../src/components/three/environment/terrainScatterRotation.ts';

// Independent XYZ matrix: the second column is the transformed local +Y.
function plantUp([rx, ry, rz]) {
  const a = Math.cos(rx), b = Math.sin(rx), c = Math.cos(ry), d = Math.sin(ry), e = Math.cos(rz), f = Math.sin(rz);
  return [-c * f, a * e - b * d * f, b * e + a * d * f];
}
const specs = [...new Set(Object.keys(LANDSCAPE_SCENES).map(landscapeForScene))];
for (const spec of specs) {
  const terrain = createLandscapeTerrain(spec), original = createLandscapeObjects(spec, terrain);
  const ecology = createLandscapeEcology(spec, terrain, original.trees);
  test(`${spec.family}: every grass/flower instance follows its capped sampled terrain normal`, () => {
    for (const kind of ['grass', 'flowers']) for (const item of ecology[kind]) {
      const [x, y, z] = item.position, step = ecologyRadius(kind, item.scale[0]) * .5;
      // Use the independent full-triangle scan, not the production spatial index.
      const height = heightOnLandscape(terrain, x, z), east = heightOnLandscape(terrain, x + step, z), north = heightOnLandscape(terrain, x, z + step);
      assert.notEqual(height, null); assert.notEqual(east, null); assert.notEqual(north, null);
      const sx = (east - height) / step, sz = (north - height) / step, slope = Math.hypot(sx, sz);
      const tilt = Math.min(MAX_SCATTER_TILT, Math.atan(slope));
      const expected = slope ? [-sx / slope * Math.sin(tilt), Math.cos(tilt), -sz / slope * Math.sin(tilt)] : [0, 1, 0];
      const actual = plantUp(item.rotation);
      actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-6, `${kind} at ${x},${z}: ${actual} != ${expected}`));
      assert.ok(Math.abs(y + .055 - height) < 1e-10);
      assert.ok(actual[1] >= Math.cos(MAX_SCATTER_TILT) - 1e-6);
    }
  });
  test(`${spec.family}: layout stays deterministic, grounded, bounded and evergreen trees stay upright`, () => {
    const before = structuredClone({ terrain, original });
    assert.deepEqual(createLandscapeEcology(spec, terrain, original.trees), ecology);
    assert.deepEqual({ terrain, original }, before);
    assert.equal(ecology.evergreens.length, BIOME_ECOLOGY_CAPACITY.evergreens);
    assert.equal(ecology.grass.length, BIOME_ECOLOGY_CAPACITY.grass);
    assert.equal(ecology.flowers.length, ENVIRONMENT_THEMES[spec.family].meadowFlowers ? BIOME_ECOLOGY_CAPACITY.flowers : 0);
    for (const tree of ecology.evergreens) assert.deepEqual([tree.rotation[0], tree.rotation[2]], [0, 0]);
    for (const [kind, items] of Object.entries(ecology)) for (const item of items) {
      const [x, y, z] = item.position, radius = ecologyRadius(kind, item.scale[0]);
      assert.ok([...item.position, ...item.rotation, ...item.scale].every(Number.isFinite));
      assert.ok(item.scale.every(n => n > 0));
      assert.ok(Math.abs(y + .055 - heightOnLandscape(terrain, x, z)) < 1e-10);
      assert.ok(Math.abs(x) - radius >= spec.inner + .2 && Math.abs(x) + radius <= spec.outer - .2);
      assert.ok(Math.abs(z) + radius <= spec.length - .4);
      if (Math.sign(x) === spec.riverSide) assert.ok(Math.abs(Math.abs(x) - landscapeRiverCentre(spec, z)) >= landscapeRiverWidth(spec, z) + radius + .55);
    }
    for (const quality of ['low', 'medium', 'high', 'cinematic']) {
      const budget = biomeEcologyBudget(quality), reduced = biomeEcologyBudget(quality, true);
      assert.deepEqual(reduced, { evergreens: 0, grass: 0, flowers: 0 });
      for (const kind of Object.keys(ecology)) {
        const count = Math.min(budget[kind], ecology[kind].length);
        assert.ok(count <= BIOME_ECOLOGY_CAPACITY[kind]);
        if (count > 3) assert.equal(new Set(ecology[kind].slice(0, count).map(item => Math.sign(item.position[0]))).size, 2);
      }
    }
  });
}
