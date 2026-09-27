import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { WOODLAND_BATCH_CAPACITY, FIREFLY_CAPACITY, boundedDrawCount, setActiveInstanceCount, effectPixelRatio } from '../src/components/three/environment/woodlandRuntimeBudget.ts';
import { woodlandAccentsLayout } from '../src/components/three/environment/woodlandAccentsLayout.ts';
import { createFireflyField, fireflyCount, FIREFLY_VERTEX, FIREFLY_FRAGMENT } from '../src/components/three/environment/woodlandFireflyField.ts';
const source = name => readFileSync(new URL(`../src/components/three/environment/${name}`, import.meta.url), 'utf8');
const qualities = ['low', 'medium', 'high', 'cinematic'];

test('fixed capacities fit all authored layouts and preserve existing quality counts', () => {
  assert.deepEqual(WOODLAND_BATCH_CAPACITY, {saplings:12, stones:10, twigs:18, fungi:12});
  assert.ok(Object.isFrozen(WOODLAND_BATCH_CAPACITY));
  for (const variant of ['enchanted-wood', 'blue-moon']) for (const quality of qualities) for (const reduced of [false, true]) {
    for (const [kind, placements] of Object.entries(woodlandAccentsLayout(variant, quality, reduced))) {
      assert.ok(placements.length <= WOODLAND_BATCH_CAPACITY[kind]);
      assert.equal(boundedDrawCount(placements.length, WOODLAND_BATCH_CAPACITY[kind]), placements.length);
    }
  }
});
test('invalid requested counts and capacities fail closed', () => {
  for (const value of [NaN, Infinity, -Infinity, -12]) {
    assert.equal(boundedDrawCount(value, 12), 0);
    assert.equal(boundedDrawCount(12, value), 0);
  }
  assert.equal(boundedDrawCount(0, 12), 0);
  assert.equal(boundedDrawCount(12, 0), 0);
});
test('draw counts are integral and never exceed the actual allocation', () => {
  assert.equal(boundedDrawCount(8.8, 12), 8);
  assert.equal(boundedDrawCount(20, 12.7), 12);
  for (let capacity=0; capacity<=18; capacity++) for (let count=-5; count<=25; count+=.25) {
    const bounded=boundedDrawCount(count,capacity);
    assert.ok(Number.isInteger(bounded) && bounded>=0 && bounded<=capacity);
  }
});
test('quality transitions reuse the same instance buffer and shrink visible counts', () => {
  const matrices={count:12}, mesh={count:0,instanceMatrix:matrices};
  for (const count of [2,4,8,12,8,2,0,12]) {
    assert.equal(setActiveInstanceCount(mesh,count),count);
    assert.equal(mesh.count,count); assert.equal(mesh.instanceMatrix,matrices);
    assert.equal(mesh.instanceMatrix.count,12);
  }
});
test('instance updates read actual buffer capacity and cannot overdraw stale matrices', () => {
  const mesh={count:12,instanceMatrix:{count:4}};
  assert.equal(setActiveInstanceCount(mesh,12),4); assert.equal(mesh.count,4);
  assert.equal(setActiveInstanceCount(mesh,NaN),0); assert.equal(mesh.count,0);
});
test('all authored quality prefixes retain positions when counts grow and shrink', () => {
  for (const variant of ['enchanted-wood','blue-moon']) {
    const full=woodlandAccentsLayout(variant,'cinematic');
    for (const quality of qualities) for (const [kind,items] of Object.entries(woodlandAccentsLayout(variant,quality))) {
      assert.deepEqual(items,full[kind].slice(0,items.length));
    }
  }
});
test('firefly positions and seeds preserve the existing high-quality prefix', () => {
  const full=createFireflyField(FIREFLY_CAPACITY), high=createFireflyField(12);
  assert.equal(full.positions.length,54); assert.equal(full.seeds.length,18);
  assert.deepEqual(full.positions.slice(0,36),high.positions);
  assert.deepEqual(full.seeds.slice(0,12),high.seeds);
  assert.deepEqual(full,createFireflyField(18));
});
test('firefly allocations remain finite and capped under invalid inputs', () => {
  for(const value of [NaN,Infinity,-Infinity,-1]) assert.equal(createFireflyField(value).seeds.length,0);
  assert.equal(createFireflyField(1e8).seeds.length,18);
  assert.equal(createFireflyField(3.9).seeds.length,3);
  assert.ok([...createFireflyField(18).positions,...createFireflyField(18).seeds].every(Number.isFinite));
});
test('accessibility exclusions and scene-specific fireflies remain unchanged', () => {
  for (const id of ['enchanted.rabbit-hole','enchanted.masked-hearth']) {
    assert.equal(fireflyCount(id,'high'),12); assert.equal(fireflyCount(id,'cinematic'),18);
    for(const quality of qualities) {
      assert.equal(fireflyCount(id,quality,true),0);
      assert.equal(fireflyCount(id,quality,false,true),0);
    }
    assert.equal(fireflyCount(id,'low'),0); assert.equal(fireflyCount(id,'medium'),0);
  }
  for(const id of ['enchanted.friendship-meadow','blue-moon.sanctuary','epilogue.constellation','']) assert.equal(fireflyCount(id,'cinematic'),0);
});
test('pixel ratios remain bounded and non-finite input resolves to standard density', () => {
  for(const value of [NaN,Infinity,-Infinity,-1,0]) assert.equal(effectPixelRatio(value),1);
  assert.equal(effectPixelRatio(.1),.5); assert.equal(effectPixelRatio(1),1);
  assert.equal(effectPixelRatio(1.5),1.5); assert.equal(effectPixelRatio(4),2);
});
test('sprite scale and size limits use consistent CSS-pixel dimensions', () => {
  for(const density of [.5,1,1.25,1.5,2]) for(const depth of [1,2,3,10,20,33]) {
    const size = Math.max(density,Math.min(14*density,65*density/depth));
    const reference = Math.max(1,Math.min(14,65/depth));
    assert.ok(Math.abs(size/density-reference)<1e-12);
  }
  assert.match(FIREFLY_VERTEX,/pointSizeMin, pointSizeMax/);
});
test('decoration constructor args no longer change with visible count or leaf geometry', () => {
  const code=source('WoodlandAccents.tsx');
  assert.match(code,/args=\{\[undefined, undefined, capacity\]\} geometry=\{geometry\}/);
  assert.doesNotMatch(code,/args=\{\[geometry, undefined, placements\.length\]\}/);
  assert.match(code,/setActiveInstanceCount\(mesh, placements\.length\)/);
  assert.match(code,/index < activeCount/);
});
test('each accent category passes its own bounded capacity', () => {
  const code=source('WoodlandAccents.tsx');
  assert.equal((code.match(/capacity=\{WOODLAND_BATCH_CAPACITY\.saplings\}/g)||[]).length,2);
  for(const kind of ['stones','twigs','fungi']) assert.match(code,new RegExp(`capacity=\\{WOODLAND_BATCH_CAPACITY\\.${kind}\\}`));
});
test('bounds, colour uploads, wind padding and disposal remain present', () => {
  const code=source('WoodlandAccents.tsx');
  for(const text of ['instanceMatrix.needsUpdate = true','instanceColor.needsUpdate = true','computeBoundingBox()','computeBoundingSphere()','expandByScalar(.14)','bark?.dispose()','leaves?.dispose()','stone.dispose()','branch.dispose()','fungi?.dispose()']) assert.ok(code.includes(text),text);
  assert.ok(code.indexOf('setActiveInstanceCount(')<code.indexOf('computeBoundingBox()'));
});
test('firefly geometry is created once per mount with only draw-range updates', () => {
  const code=source('WoodlandFireflies.tsx');
  assert.match(code,/createFireflyField\(FIREFLY_CAPACITY\)/);
  assert.match(code,/return result;\s*\}, \[\]\)/);
  assert.match(code,/result\.setDrawRange\(0, 0\)/);
  assert.match(code,/geometry\.setDrawRange\(0, boundedDrawCount\(count, FIREFLY_CAPACITY\)\)/);
  assert.match(code,/useLayoutEffect\(/); assert.match(code,/geometry\.dispose\(\)/);
});
test('point-size uniforms stay stable and update without allocations inside the frame callback', () => {
  const code=source('WoodlandFireflies.tsx');
  assert.match(code,/pointSizeMin: \{ value: 1 \}/); assert.match(code,/pointSizeMax: \{ value: 14 \}/);
  const callback=code.slice(code.indexOf('useFrame('),code.indexOf('return <points'));
  assert.match(callback,/uniforms\.pointScale\.value = 65 \* pixelRatio/);
  assert.match(callback,/uniforms\.pointSizeMax\.value = 14 \* pixelRatio/);
  assert.doesNotMatch(callback,/new |setState|setDrawRange|createFireflyField|getParameter/);
});
test('invisible fragments exit before square-root and fog evaluation', () => {
  assert.match(FIREFLY_FRAGMENT,/if \(radiusSquared >= 1\.\) discard/);
  assert.match(FIREFLY_FRAGMENT,/if \(opacity <= 0\. \|\| nearFade <= 0\. \|\| farFade <= 0\.\) discard/);
  assert.ok(FIREFLY_FRAGMENT.indexOf('discard')<FIREFLY_FRAGMENT.indexOf('sqrt('));
  assert.ok(FIREFLY_FRAGMENT.indexOf('discard')<FIREFLY_FRAGMENT.indexOf('exp('));
  assert.match(FIREFLY_FRAGMENT,/#include <tonemapping_fragment>/);
  assert.match(FIREFLY_FRAGMENT,/#include <colorspace_fragment>/);
});
test('world behaviour is unchanged and no new lights or animation owners are introduced', () => {
  for(const name of ['WoodlandAccents.tsx','WoodlandFireflies.tsx']) {
    const code=source(name);
    assert.doesNotMatch(code,/pointLight|spotLight|directionalLight|requestAnimationFrame|dispatchStoryEvent|localStorage|RigidBody/);
    assert.match(code,/raycast=\{IGNORE_RAYCAST\}/);
  }
  const fireflies=source('WoodlandFireflies.tsx');
  assert.match(fireflies,/presentation\.time\.particles/);
  assert.match(fireflies,/readAtmosphereFogDensity\(scene\.fog\)/);
  assert.match(fireflies,/count > 0 \? <FireflyBatch count=\{count\} \/> : null/);
});
