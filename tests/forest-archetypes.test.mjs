import assert from 'node:assert/strict';
import test from 'node:test';
import * as THREE from 'three';
import {
  FOREST_ARCHETYPES,
  FOREST_REFERENCE_TRUNK_SCALE,
  FOREST_REFERENCE_CROWN_SCALE,
  FOREST_REFERENCE_CROWN_HEIGHT,
  createForestTrunkGeometry,
  createOrganicCrownGeometry,
  createForestTrunkLibrary,
  createForestCrownLibrary,
  createForestArchetypeGeometry,
  getForestArchetypeBranchSupports,
} from '../src/world/forest/forestGeometry.ts';
import * as historical from '../src/components/three/environment/forestGeometry.ts';

function checkGeometry(geometry) {
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  assert.ok(position.count > 0);
  for (const name of ['normal', 'uv', 'color']) {
    const attribute = geometry.getAttribute(name);
    assert.equal(attribute.count, position.count);
    assert.ok([...attribute.array].every(Number.isFinite));
  }
  assert.ok([...position.array].every(Number.isFinite));
  for (let i = 0; i < normal.count; i++) {
    assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-5);
  }
  for (const index of geometry.index.array) assert.ok(index >= 0 && index < position.count);
  assert.ok(geometry.index.count / 3 <= 600);
  assert.equal(geometry.groups.length, 0);
  assert.ok(geometry.boundingSphere.radius > 0 && geometry.boundingSphere.radius < 6);
  for (let i = 0; i < geometry.index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(position, geometry.index.getX(i));
    const b = new THREE.Vector3().fromBufferAttribute(position, geometry.index.getX(i + 1));
    const c = new THREE.Vector3().fromBufferAttribute(position, geometry.index.getX(i + 2));
    assert.ok(b.sub(a).cross(c.sub(a)).length() > 1e-8, `${geometry.name} degenerate triangle ${i / 3}`);
  }
}

for (const detail of [0, 1, 2]) {
  test(`all eight detail-${detail} forms have deterministic matching topology and valid finite surfaces`, () => {
    let trunkIndices, crownIndices;
    for (const type of FOREST_ARCHETYPES) {
      const pair = createForestArchetypeGeometry(type, detail);
      const again = createForestArchetypeGeometry(type, detail);
      try {
        for (const part of ['trunk', 'crown']) {
          checkGeometry(pair[part]);
          for (const attribute of ['position', 'normal', 'uv', 'color']) {
            assert.deepEqual(pair[part].getAttribute(attribute).array, again[part].getAttribute(attribute).array);
          }
        }
        trunkIndices ??= pair.trunk.index.array;
        crownIndices ??= pair.crown.index.array;
        assert.deepEqual(pair.trunk.index.array, trunkIndices);
        assert.deepEqual(pair.crown.index.array, crownIndices);
        assert.ok(Math.abs(pair.trunk.boundingBox.min.y + .5) < .005, `${type} roots must retain the supported foot`);
      } finally {
        Object.values(pair).forEach(g => g.dispose());
        Object.values(again).forEach(g => g.dispose());
      }
    }
  });
}

test('historical constructors are the same ordinary builders and never require morph initialization', () => {
  assert.equal(historical.createForestTrunkGeometry, createForestTrunkGeometry);
  assert.equal(historical.createOrganicCrownGeometry, createOrganicCrownGeometry);
  for (const geometry of [createForestTrunkGeometry(), ...[0, 1, 2].map(createOrganicCrownGeometry)]) {
    try {
      checkGeometry(geometry);
      assert.equal(geometry.morphAttributes.position, undefined);
      assert.equal(geometry.morphAttributes.normal, undefined);
      assert.equal(geometry.userData.requiresInitializedMorphWeights, undefined);
    } finally { geometry.dispose(); }
  }
  assert.throws(() => createForestArchetypeGeometry('unknown'), RangeError);
  assert.throws(() => getForestArchetypeBranchSupports('unknown'), RangeError);
});

test('explicit libraries contain independent position and normal targets with union bounds', () => {
  for (const geometry of [createForestTrunkLibrary(), ...[0, 1, 2].map(createForestCrownLibrary)]) {
    try {
      checkGeometry(geometry);
      assert.equal(geometry.morphTargetsRelative, false);
      assert.equal(geometry.morphAttributes.position.length, 8);
      assert.equal(geometry.morphAttributes.normal.length, 8);
      assert.equal(geometry.userData.requiresInitializedMorphWeights, true);
      assert.deepEqual(geometry.userData.archetypeIds, FOREST_ARCHETYPES);
      const base = geometry.getAttribute('position');
      for (let target = 0; target < 8; target++) {
        const position = geometry.morphAttributes.position[target];
        const normal = geometry.morphAttributes.normal[target];
        assert.equal(position.count, base.count);
        assert.equal(normal.count, base.count);
        assert.notEqual(position.array, base.array);
        assert.ok([...position.array, ...normal.array].every(Number.isFinite));
        for (let i = 0; i < position.count; i++) {
          const point = new THREE.Vector3().fromBufferAttribute(position, i);
          assert.ok(geometry.boundingBox.containsPoint(point));
          assert.ok(point.distanceTo(geometry.boundingSphere.center) <= geometry.boundingSphere.radius + 1e-6);
          assert.ok(Math.abs(Math.hypot(normal.getX(i), normal.getY(i), normal.getZ(i)) - 1) < 1e-5);
        }
      }
    } finally { geometry.dispose(); }
  }
});

test('supported branch tips share canopy anchors under arbitrary paired transforms', () => {
  const localCrown = new THREE.Matrix4()
    .makeTranslation(0, FOREST_REFERENCE_CROWN_HEIGHT / FOREST_REFERENCE_TRUNK_SCALE[1] - .5, 0)
    .multiply(new THREE.Matrix4().makeScale(...FOREST_REFERENCE_CROWN_SCALE.map((v, i) => v / FOREST_REFERENCE_TRUNK_SCALE[i])));
  const trunkTransform = new THREE.Matrix4().compose(
    new THREE.Vector3(13, 7, -24),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(.03, 2.7, -.017)),
    new THREE.Vector3(.28, 14.8, .28),
  );
  const crownTransform = trunkTransform.clone().multiply(localCrown);
  for (const type of FOREST_ARCHETYPES) {
    const pair = createForestArchetypeGeometry(type, 2);
    try {
      getForestArchetypeBranchSupports(type).forEach((reference, i) => {
        const tipIndex = pair.trunk.userData.branchTipVertexIndices[i];
        const tip = new THREE.Vector3().fromBufferAttribute(pair.trunk.attributes.position, tipIndex);
        const supported = tip.clone().multiply(new THREE.Vector3(...FOREST_REFERENCE_TRUNK_SCALE));
        supported.y += FOREST_REFERENCE_TRUNK_SCALE[1] * .5;
        assert.ok(supported.distanceTo(new THREE.Vector3(...reference)) < 1e-6, `${type} unsupported branch ${i}`);
        const crownLocal = new THREE.Vector3(
          reference[0] / FOREST_REFERENCE_CROWN_SCALE[0],
          (reference[1] - FOREST_REFERENCE_CROWN_HEIGHT) / FOREST_REFERENCE_CROWN_SCALE[1],
          reference[2] / FOREST_REFERENCE_CROWN_SCALE[2],
        );
        assert.ok(tip.clone().applyMatrix4(trunkTransform).distanceTo(crownLocal.applyMatrix4(crownTransform)) < 1e-6);
      });
    } finally { Object.values(pair).forEach(g => g.dispose()); }
  }
});

// Fit the best arbitrary affine transform, which includes translation, rotation,
// uniform/nonuniform scale and shear. A remaining residual proves authored shapes
// differ beyond changing their instance transform. This is CPU evidence only.
function affineResidual(source, target) {
  const count = source.count;
  const normal = Array.from({ length: 4 }, () => [0, 0, 0, 0]);
  const rhs = Array.from({ length: 3 }, () => [0, 0, 0, 0]);
  for (let i = 0; i < count; i++) {
    const basis = [source.getX(i), source.getY(i), source.getZ(i), 1];
    const output = [target.getX(i), target.getY(i), target.getZ(i)];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) normal[row][col] += basis[row] * basis[col];
      for (let axis = 0; axis < 3; axis++) rhs[axis][row] += basis[row] * output[axis];
    }
  }
  const fit = rhs.map(values => {
    const matrix = normal.map((row, i) => [...row, values[i]]);
    for (let col = 0; col < 4; col++) {
      let pivot = col;
      for (let row = col + 1; row < 4; row++) if (Math.abs(matrix[row][col]) > Math.abs(matrix[pivot][col])) pivot = row;
      [matrix[col], matrix[pivot]] = [matrix[pivot], matrix[col]];
      assert.ok(Math.abs(matrix[col][col]) > 1e-10);
      const divisor = matrix[col][col];
      for (let j = col; j < 5; j++) matrix[col][j] /= divisor;
      for (let row = 0; row < 4; row++) if (row !== col) {
        const factor = matrix[row][col];
        for (let j = col; j < 5; j++) matrix[row][j] -= matrix[col][j] * factor;
      }
    }
    return matrix.map(row => row[4]);
  });
  let squared = 0;
  for (let i = 0; i < count; i++) {
    const basis = [source.getX(i), source.getY(i), source.getZ(i), 1];
    const output = [target.getX(i), target.getY(i), target.getZ(i)];
    for (let axis = 0; axis < 3; axis++) squared += (fit[axis].reduce((sum, coefficient, j) => sum + coefficient * basis[j], 0) - output[axis]) ** 2;
  }
  return Math.sqrt(squared / (count * 3));
}

test('all archetypes change both trunk and canopy shape beyond any instance transform', () => {
  const broad = createForestArchetypeGeometry('old-broad', 2);
  try {
    for (const type of FOREST_ARCHETYPES.slice(1)) {
      const pair = createForestArchetypeGeometry(type, 2);
      try {
        for (const part of ['trunk', 'crown']) {
          const residual = affineResidual(broad[part].attributes.position, pair[part].attributes.position);
          assert.ok(residual > .025, `${type} ${part} affine residual ${residual}`);
        }
      } finally { Object.values(pair).forEach(g => g.dispose()); }
    }
  } finally { Object.values(broad).forEach(g => g.dispose()); }
});

test('canopies contain independent small folded leaves with no faces connecting their gaps', () => {
  for (const detail of [0, 1, 2]) {
    for (const type of FOREST_ARCHETYPES) {
      const pair = createForestArchetypeGeometry(type, detail);
      try {
        const g = pair.crown, p = g.attributes.position;
        const blades = detail === 0 ? 70 : 266;
        assert.equal(p.count, blades * 4);
        assert.equal(g.index.count, blades * 6);
        for (let leaf = 0; leaf < blades; leaf++) {
          const offset = leaf * 4;
          assert.deepEqual([...g.index.array.slice(leaf * 6, leaf * 6 + 6)], [0, 1, 2, 0, 2, 3].map(i => i + offset));
          const vertices = Array.from({ length: 4 }, (_, i) => new THREE.Vector3().fromBufferAttribute(p, offset + i));
          for (const a of vertices) for (const b of vertices) assert.ok(a.distanceTo(b) < (detail === 0 ? .7 : .5), 'bounded sprays/blades must not become oversized shards');
          const a = vertices[1].clone().sub(vertices[0]);
          const b = vertices[2].clone().sub(vertices[0]);
          const c = vertices[3].clone().sub(vertices[0]);
          assert.ok(Math.abs(a.cross(b).dot(c)) > 1e-7, 'folded blade must have depth');
        }
      } finally { Object.values(pair).forEach(g => g.dispose()); }
    }
  }
});

test('open-canopy keeps actual central air gaps on both low and rich geometry', () => {
  for (const detail of [0, 2]) {
    const pair = createForestArchetypeGeometry('open-canopy', detail);
    const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    try {
      const mesh = new THREE.Mesh(pair.crown, material);
      const ray = new THREE.Raycaster();
      for (const x of [-.12, 0, .12]) {
        ray.set(new THREE.Vector3(x, .2, 5), new THREE.Vector3(0, 0, -1));
        assert.equal(ray.intersectObject(mesh).length, 0, `detail${detail} central gap x=${x}`);
      }
    } finally { Object.values(pair).forEach(g => g.dispose()); material.dispose(); }
  }
});

test('living canopy islands have projected foliage coverage while retaining air', () => {
  const material = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const ray = new THREE.Raycaster();
  try {
    for (const detail of [0, 2]) {
      for (const type of ['old-broad', 'narrow-reaching', 'twisted', 'leaning', 'young', 'open-canopy']) {
        const pair = createForestArchetypeGeometry(type, detail);
        try {
          const crown = pair.crown, position = crown.attributes.position;
          const mesh = new THREE.Mesh(crown, material);
          const leaves = detail === 0 ? 10 : 38;
          const coverage = [];
          for (let island = 0; island < 7; island++) {
            crown.setDrawRange(island * leaves * 6, leaves * 6);
            const bounds = new THREE.Box3();
            for (let i = island * leaves * 4; i < (island + 1) * leaves * 4; i++) {
              bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(position, i));
            }
            let covered = 0;
            const grid = 24;
            for (let row = 0; row < grid; row++) for (let column = 0; column < grid; column++) {
              ray.set(new THREE.Vector3(
                THREE.MathUtils.lerp(bounds.min.x, bounds.max.x, (column + .5) / grid),
                THREE.MathUtils.lerp(bounds.min.y, bounds.max.y, (row + .5) / grid),
                bounds.max.z + 1,
              ), new THREE.Vector3(0, 0, -1));
              if (ray.intersectObject(mesh).length > 0) covered++;
            }
            const ratio = covered / (grid * grid);
            assert.ok(ratio >= .22 && ratio <= .6, `${type} detail${detail} island${island} coverage${ratio}`);
            coverage.push(ratio);
          }
          const average = coverage.reduce((sum, ratio) => sum + ratio, 0) / coverage.length;
          assert.ok(average >= .3 && average <= .55, `${type} detail${detail} must retain living open mass`);
        } finally { Object.values(pair).forEach(g => g.dispose()); }
      }
    }
  } finally { material.dispose(); }
});

test('healthy leaders taper to small supported tips instead of cut poles', () => {
  for (const type of FOREST_ARCHETYPES.filter(type => type !== 'broken' && type !== 'partially-dead')) {
    const pair = createForestArchetypeGeometry(type, 2);
    try {
      const position = pair.trunk.attributes.position;
      const metrePoint = index => new THREE.Vector3().fromBufferAttribute(position, index).multiply(new THREE.Vector3(...FOREST_REFERENCE_TRUNK_SCALE));
      const tip = metrePoint(pair.trunk.userData.leaderTipVertexIndex);
      for (const index of pair.trunk.userData.leaderRingVertexIndices) assert.ok(metrePoint(index).distanceTo(tip) < .02);
    } finally { Object.values(pair).forEach(g => g.dispose()); }
  }
});

test('bark wrap seams have exact position/color twins, unwrapped UVs and matching smooth normals', () => {
  for (const type of FOREST_ARCHETYPES) {
    const pair = createForestArchetypeGeometry(type, 2);
    try {
      const geometry = pair.trunk;
      const position = geometry.attributes.position, normal = geometry.attributes.normal;
      const color = geometry.attributes.color, uv = geometry.attributes.uv;
      assert.equal(position.count, 208);
      const seams = geometry.userData.seamVertexPairs;
      assert.ok(seams.length > 0);
      for (const [first, twin] of seams) {
        for (const attribute of [position, normal, color]) {
          assert.deepEqual([...attribute.array.slice(first * 3, first * 3 + 3)], [...attribute.array.slice(twin * 3, twin * 3 + 3)]);
        }
        assert.equal(uv.getX(first), 0);
        assert.equal(uv.getX(twin), 1);
        assert.equal(uv.getY(first), uv.getY(twin));
      }
      // Caps may span half the UV map; side faces never cross its wrap. The old
      // shared endpoint produced spans .875 on the bole and .667 on branches.
      for (let face = 0; face < geometry.index.count; face += 3) {
        const values = [0, 1, 2].map(offset => uv.getX(geometry.index.getX(face + offset)));
        assert.ok(Math.max(...values) - Math.min(...values) <= .5 + 1e-6);
      }
    } finally { Object.values(pair).forEach(g => g.dispose()); }
  }
});

test('library triangle counts leave the unchanged paired capacity allowance intact', () => {
  const trunk = createForestTrunkGeometry();
  try {
    assert.equal(trunk.index.count / 3, 292);
    for (const detail of [0, 1, 2]) {
      const crown = createOrganicCrownGeometry(detail);
      try {
        assert.equal(crown.index.count / 3, detail === 0 ? 140 : 532);
        const delta = (trunk.index.count / 3 - 266 + crown.index.count / 3 - [140, 560, 532][detail]) * 243;
        assert.ok(delta <= 13000);
      } finally { crown.dispose(); }
    }
  } finally { trunk.dispose(); }
});
