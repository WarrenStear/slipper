import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { makeStorySheet, paperBirdPositions } from '../src/components/three/storyEvents/visualGeometry.ts';
const source = path => readFileSync(new URL(path, import.meta.url), 'utf8');
for (const kind of ['petal', 'feather', 'cloth', 'paper']) {
  test(`${kind} geometry is finite, bounded, indexed, and deterministic`, () => {
    const mesh = makeStorySheet(kind);
    assert.equal(mesh.positions.length, 169 * 3);
    assert.equal(mesh.uvs.length, 169 * 2);
    assert.equal(mesh.indices.length, 12 * 12 * 6);
    assert.ok(mesh.positions.every(Number.isFinite));
    assert.ok(mesh.positions.every(value => Math.abs(value) < 1));
    assert.ok(mesh.uvs.every(value => value >= 0 && value <= 1));
    assert.ok(mesh.indices.every(value => Number.isInteger(value) && value >= 0 && value < 169));
    assert.deepEqual(mesh, makeStorySheet(kind));
  });
}
test('detail requests cannot create unbounded geometry', () => {
  for (const count of [-1, 0, NaN, Infinity, 10000, 4.9]) {
    const mesh = makeStorySheet('cloth', count);
    assert.ok(mesh.positions.length >= 25 * 3 && mesh.positions.length <= 625 * 3);
    assert.ok(mesh.positions.every(Number.isFinite));
  }
});
test('sheets preserve a visible surface instead of collapsing to a point', () => {
  for (const kind of ['petal', 'feather', 'cloth', 'paper']) {
    const { positions, indices } = makeStorySheet(kind);
    let area = 0;
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]*3, b = indices[i+1]*3, c = indices[i+2]*3;
      const ab = positions.slice(b,b+3).map((value,j) => value-positions[a+j]);
      const ac = positions.slice(c,c+3).map((value,j) => value-positions[a+j]);
      area += Math.hypot(ab[1]*ac[2]-ab[2]*ac[1],ab[2]*ac[0]-ab[0]*ac[2],ab[0]*ac[1]-ab[1]*ac[0])/2;
    }
    assert.ok(area > .001 && area < 1, kind);
  }
});
test('folded paper uses eight finite triangular facets', () => {
  const positions = paperBirdPositions();
  assert.equal(positions.length, 8*9);
  assert.ok(positions.every(value => Number.isFinite(value) && Math.abs(value) < 1));
  assert.deepEqual(positions, paperBirdPositions());
});
test('hero rendering contains no progression writes or timed state', () => {
  const text = source('../src/components/three/storyEvents/StoryHeroProps.tsx');
  assert.doesNotMatch(text, /useJourneyStore|dispatchStoryEvent|setState|useFrame|Math\.random|Date\.now/);
  for (const name of ['MemoryRose','MemoryFeather','StoryLinen','ClothboundBook','DomesticChair','FoldedPaperBird']) assert.ok(text.includes(name));
  assert.match(text, /geometry\.dispose\(\)/);
});
test('surface shaders retain lit materials and independent program cache keys', () => {
  const text = (source('../src/components/three/storyEvents/TactileMaterial.tsx') + source('../src/components/three/storyEvents/tactileShader.ts'));
  assert.match(text, /meshStandardMaterial/);
  assert.match(text, /customProgramCacheKey/);
  assert.match(text, /fwidth/);
  assert.doesNotMatch(text, /TextureLoader|setState|requestAnimationFrame|WebGLRenderTarget/);
});
test('floor visual treatment consumes the existing mask and does not grant events', () => {
  const text = source('../src/world/opening/WetFloorReveal.tsx') + source('../src/world/opening/wetFloorShader.ts');
  assert.match(text, /texture2D\(coverageMask,vUv\)/);
  assert.match(text, /planeGeometry args=\{\[12\.8, 12\.5\]\}/);
  assert.match(text, /woodHash/);
  assert.doesNotMatch(text, /dispatchStoryEvent|setState|localStorage/);
});
test('threshold changes remain CSS-only with visible focus and reduced-motion paths', () => {
  // Comments may describe the old hidden state; only declarations are checked.
  const text = source('../src/visualPresentation.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.match(text, /prefers-reduced-motion/);
  assert.match(text, /forced-colors/);
  assert.match(text, /:focus-within/);
  assert.doesNotMatch(text, /visibility:\s*hidden|display:\s*none|url\(/);
  assert.match(text, /max-height: 500px/);
});
