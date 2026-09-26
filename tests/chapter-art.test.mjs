import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createConstructionGeometry, createUpholsteryGeometry, createSteppingStoneGeometry, createBasinGeometry, createFlightSilhouetteGeometry } from '../src/components/three/chapters/chapterArtGeometry.ts';

function validGeometry(geometry, budget) {
  const positions = geometry.getAttribute('position');
  assert.ok(positions.count > 0 && positions.count <= budget);
  for (const name of ['position', 'normal', 'uv']) {
    const attribute = geometry.getAttribute(name);
    assert.ok(attribute && attribute.count === positions.count, name);
    assert.ok([...attribute.array].every(Number.isFinite), name);
  }
  const index = geometry.getIndex();
  if (index) assert.ok([...index.array].every(i => i >= 0 && i < positions.count));
  assert.ok(Number.isFinite(geometry.boundingSphere.radius));
}

test('construction merges material batches without changing the authored outer envelope', () => {
  const pieces = [
    { position: [-2, 2, 0], size: [.42, 4, .5] },
    { position: [2, 2, 0], size: [.42, 4, .5] },
    { position: [0, 4, 0], size: [4.42, .45, .5] },
  ];
  for (const plaster of [false, true]) {
    const geometry = createConstructionGeometry(pieces, plaster);
    validGeometry(geometry, 5000);
    assert.equal(geometry.groups.length, 0, 'one material draw, no per-piece material groups');
    assert.ok(geometry.getAttribute('color').count === geometry.getAttribute('position').count);
    const box = geometry.boundingBox;
    assert.ok(box.min.x >= -2.21001 && box.max.x <= 2.21001);
    assert.ok(box.min.y >= -.00001 && box.max.y <= 4.22501);
    assert.ok(box.min.z >= -.25001 && box.max.z <= .25001);
    geometry.dispose();
  }
});

test('stepping stones preserve the original top surface and remain a cheap deterministic shared form', () => {
  const first = createSteppingStoneGeometry(), second = createSteppingStoneGeometry();
  validGeometry(first, 64);
  assert.deepEqual(first.getAttribute('position').array, second.getAttribute('position').array);
  assert.equal(first.boundingBox.max.z, 0, 'no new raised collision surface');
  assert.ok(first.boundingBox.min.z >= -.071);
  assert.ok(Math.max(Math.abs(first.boundingBox.min.x), first.boundingBox.max.x, Math.abs(first.boundingBox.min.y), first.boundingBox.max.y) <= 1);
  assert.ok(first.getIndex().count / 3 < 80);
  first.dispose(); second.dispose();
});

test('upholstery softens corners inside the original furniture bounds', () => {
  const geometry = createUpholsteryGeometry([2.25, .38, 1.57]);
  validGeometry(geometry, 1000);
  const box = geometry.boundingBox;
  assert.ok(box.min.x >= -1.12501 && box.max.x <= 1.12501);
  assert.ok(box.min.y >= -.19001 && box.max.y <= .19001);
  assert.ok(box.min.z >= -.78501 && box.max.z <= .78501);
  assert.ok(box.max.y > .18 && box.max.x > 1.1, 'form remains full and recognisable');
  geometry.dispose();
});

test('basin has an inset bowl and bounded rolled rim, and flock shares one finite silhouette', () => {
  const basin = createBasinGeometry();
  validGeometry(basin, 1000);
  assert.ok(basin.boundingBox.max.x <= 1.68001 && basin.boundingBox.max.y <= .22501);
  const position = basin.getAttribute('position');
  const inner = Array.from({ length: position.count }, (_, i) => [Math.hypot(position.getX(i), position.getZ(i)), position.getY(i)]);
  assert.ok(inner.some(([r, y]) => r > 1.3 && r < 1.5 && y < 0), 'visible recessed bowl wall');
  const bird = createFlightSilhouetteGeometry();
  validGeometry(bird, 100);
  assert.ok(bird.boundingBox.max.x <= .65 && bird.boundingBox.min.x >= -.65);
  basin.dispose(); bird.dispose();
});

test('art keeps the existing house doorway gap, wax batching, and store-free geometry', () => {
  const read = name => readFileSync(new URL(name, import.meta.url), 'utf8');
  const house = read('../src/components/three/chapters/ThornedHouseChapter.tsx');
  assert.match(house, /HouseShell rearOpening=\{4\.6\}/);
  assert.match(house, /position=\{\[-1\.72, 2\.18, -0\.1\]\} rotation=\{\[0, -openAmount, 0\]\}/);
  assert.match(house, /resolveThornedHouseColliderLayout/);
  const shared = read('../src/components/three/chapters/ChapterPrimitives.tsx');
  assert.match(shared, /waxRef\} geometry=\{waxGeometry\}/);
  assert.match(shared, /flameRef\} geometry=\{flameGeometry\}/);
  assert.match(shared, /shared-departing-bird-silhouettes/);
  assert.doesNotMatch(read('../src/components/three/chapters/chapterArtGeometry.ts'), /Math\.random|Date\.now|useFrame|dispatchStoryEvent|useJourneyStore|WebGLRenderTarget/);
});


test('construction grain stays in each board frame through assembly transforms', () => {
  for (const size of [[3.65,.18,.408],[.18,1.52,.19],[.23,.35,15.5]]) {
    const original=createConstructionGeometry([{position:[0,0,0],size}]);
    const moved=createConstructionGeometry([{position:[7,3,-5],rotation:[.3,.8,-.2],size}]);
    try {
      for (const name of ['storySurfacePosition','storySurfaceNormal','uv']) {
        assert.deepEqual(original.getAttribute(name).array,moved.getAttribute(name).array,name);
        assert.ok([...original.getAttribute(name).array].every(Number.isFinite));
      }
      assert.equal(original.index.count/3,60,'construction remains one 60-triangle board');
      const grain=original.getAttribute('storySurfacePosition');
      const ys=Array.from({length:grain.count},(_,i)=>grain.getY(i));
      assert.ok(Math.abs(Math.max(...ys)-Math.min(...ys)-Math.max(...size))<1e-5,'grain Y follows longest board dimension');
      const n=original.getAttribute('storySurfaceNormal');
      for(let i=36;i<52;i++)assert.ok(Math.abs(n.getY(i))>.999,'cut caps have distinct end-grain normals');
      const uv=original.getAttribute('uv');
      assert.ok(Math.abs((uv.getY(18)-uv.getY(9))*2.2-Math.max(...size)*.91)<1e-5,'UV length follows the actual long middle span');
      assert.notDeepEqual(original.getAttribute('position').array,moved.getAttribute('position').array);
    } finally {original.dispose();moved.dispose()}
  }
});
