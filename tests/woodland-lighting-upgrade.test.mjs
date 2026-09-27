import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { woodlandAccentsLayout, woodlandAccentTier } from '../src/components/three/environment/woodlandAccentsLayout.ts';
import { AUTHORED_SHAFTS, sceneSkyReturn } from '../src/components/three/artDirection/sceneLightAccents.ts';

const qualities = ['low', 'medium', 'high', 'cinematic'];
const variants = ['enchanted-wood', 'blue-moon'];
const read = path => readFileSync(new URL(`../src/components/three/${path}`, import.meta.url), 'utf8');
const radius = (kind, item) => ({ saplings: 1.65, stones: 1.15, twigs: .85 }[kind] * item.scale[0]);

test('woodland accents have deterministic positive finite transforms at every tier', () => {
  for (const variant of variants) for (const quality of qualities) for (const reduced of [false, true]) {
    const layout = woodlandAccentsLayout(variant, quality, reduced);
    assert.deepEqual(layout, woodlandAccentsLayout(variant, quality, reduced));
    for (const items of Object.values(layout)) for (const item of items) {
      assert.ok([...item.position, ...item.rotation, ...item.scale].every(Number.isFinite));
      assert.ok(item.scale.every(value => value > 0));
    }
  }
});
test('quality changes retain stable composition prefixes', () => {
  for (const variant of variants) {
    const full = woodlandAccentsLayout(variant, 'cinematic');
    for (const quality of qualities) {
      const layout = woodlandAccentsLayout(variant, quality);
      for (const kind of Object.keys(full)) assert.deepEqual(layout[kind], full[kind].slice(0, layout[kind].length));
    }
  }
});
test('reduced effects and unknown quality use the bounded low tier', () => {
  assert.equal(woodlandAccentTier('unknown', false), 0);
  for (const variant of variants) for (const quality of [...qualities, 'unknown']) {
    assert.deepEqual(woodlandAccentsLayout(variant, quality, true), woodlandAccentsLayout(variant, 'low'));
  }
});
test('additional instance counts remain capped and sanctuary gets no extra trees', () => {
  for (const variant of variants) {
    const layout = woodlandAccentsLayout(variant, 'cinematic');
    assert.equal(layout.saplings.length, variant === 'blue-moon' ? 0 : 8);
    assert.equal(layout.stones.length, 10); assert.equal(layout.twigs.length, 18);
  }
});
test('complete accent envelopes stay on the existing ground and outside the central path', () => {
  for (const variant of variants) for (const [kind, items] of Object.entries(woodlandAccentsLayout(variant, 'cinematic'))) {
    for (const item of items) {
      const [x, y, z] = item.position, envelope = radius(kind, item);
      assert.ok(Math.hypot(x, z) + envelope < 16, `${variant}/${kind} leaves the ground`);
      assert.ok(Math.abs(x) - envelope > (variant === 'blue-moon' ? 9.5 : 6), `${variant}/${kind} enters the route`);
      assert.ok(y >= -.2 && y <= -.19);
    }
  }
});
test('the existing pond and flowers keep their clear envelope', () => {
  for (const [kind, items] of Object.entries(woodlandAccentsLayout('enchanted-wood', 'cinematic'))) for (const item of items) {
    assert.ok(Math.hypot(item.position[0] + 4.8, item.position[2] - 1.4) - radius(kind, item) > 3.6, `${kind} enters pond envelope`);
  }
});
test('authored shafts are finite, gentle and capped at three', () => {
  for (const shafts of Object.values(AUTHORED_SHAFTS)) {
    assert.ok(shafts.length <= 3);
    for (const shaft of shafts) {
      assert.ok([...shaft.from, ...shaft.to, shaft.radius, shaft.opacity].every(Number.isFinite));
      assert.ok(shaft.from[1] > shaft.to[1]);
      assert.ok(shaft.radius > 0 && shaft.radius <= 3.4);
      assert.ok(shaft.opacity > 0 && shaft.opacity <= .035);
    }
  }
});
test('moon shafts remain on the banks with the quietest opacity', () => {
  for (const id of ['blue-moon.sanctuary', 'blue-moon.intimacy']) for (const shaft of AUTHORED_SHAFTS[id]) {
    assert.ok(Math.abs(shaft.to[0]) > 8);
    assert.ok(shaft.opacity <= .012);
    assert.deepEqual(shaft.from, [6, 18, 38]);
  }
});
test('quiet and interior chapters do not inherit additional sky lighting or shafts', () => {
  for (const id of ['sunset.stillness', 'river.release-surrender', 'epilogue.constellation', 'thorned.old-memory-bedroom', 'fire.boundary', 'enchanted.unknown']) {
    assert.equal(sceneSkyReturn(id), null); assert.equal(AUTHORED_SHAFTS[id], undefined);
  }
});
test('sky returns are much weaker than the key and use finite scene-local positions', () => {
  for (const id of ['enchanted.rabbit-hole', 'blue-moon.sanctuary', 'nest.protection', 'crowned.home']) {
    const light = sceneSkyReturn(id); assert.ok(light);
    assert.ok(light.position.every(Number.isFinite)); assert.match(light.color, /^#[0-9a-f]{6}$/);
    assert.ok(light.intensity > 0 && light.intensity <= .22);
  }
});
test('accent wiring retains the original habitat and stays decorative', () => {
  assert.match(read('environment/WoodlandHabitat.tsx'), /<WoodlandAccents variant=\{variant\} quality=\{quality\} reducedEffects=\{reducedEffects\}/);
  const layer = read('environment/WoodlandAccents.tsx');
  for (const pattern of [/computeBoundingBox/, /computeBoundingSphere/, /expandByScalar/, /instanceMatrix\.needsUpdate/, /geometry\?\.dispose/, /raycast=\{IGNORE_RAYCAST\}/]) assert.match(layer, pattern);
  assert.doesNotMatch(layer, /useFrame|Math\.random|Date\.now|RigidBody|dispatchStoryEvent|useJourneyStore|scene\.fog/);
});
test('light and fog effects stay quality-gated, near-camera faded and scene-clock driven', () => {
  for (const path of ['artDirection/VolumetricLightShaft.tsx', 'artDirection/GroundMist.tsx']) {
    const code = read(path);
    assert.match(code, /look\.budget\.shafts/); assert.match(code, /presentation\.time\.vegetation/);
    assert.match(code, /float nearby=smoothstep/); assert.match(code, /depthWrite=\{false\}/);
    assert.doesNotMatch(code, /getElapsedTime|Date\.now|requestAnimationFrame/);
  }
  const lighting = read('artDirection/SceneLighting.tsx');
  assert.match(lighting, /look\.budget\.shafts && accent/);
  assert.match(lighting, /intensity=\{accent\.intensity\} castShadow=\{false\}/);
  assert.match(read('artDirection/VolumetricLightShaft.tsx'), /forceSinglePass/);
});
