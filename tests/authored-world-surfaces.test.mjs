import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { woodlandHabitatLayout, habitatTier } from '../src/components/three/environment/woodlandHabitatLayout.ts';
import { createFernGeometry, createRushGeometry, createLeafLitterGeometry, createDeadwoodGeometry, createRootThresholdGeometry } from '../src/components/three/environmentArt/woodlandHabitatGeometry.ts';
import { createOrganicCrownGeometry } from '../src/world/forest/forestGeometry.ts';
import { STORY_SURFACES, applyTactileShader, tactileProgramKey } from '../src/components/three/storyEvents/tactileShader.ts';
import { applyFoliageFinish } from '../src/components/three/environment/foliageFinish.ts';
const read = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
const template = () => ({ vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <roughnessmap_fragment>\n#include <normal_fragment_maps>\n#include <colorspace_fragment>\n#include <fog_fragment>' });

for (const variant of ['enchanted-wood','blue-moon']) {
  test(`${variant} habitat has deterministic, finite, tier-bounded transforms`, () => {
    for (const quality of ['low','medium','high','cinematic']) {
      const a=woodlandHabitatLayout(variant,quality), b=woodlandHabitatLayout(variant,quality);
      assert.deepEqual(a,b); assert.ok(a.plants.length<=26); assert.ok(a.litter.length<=92); assert.equal(a.timber.length,2);
      for (const item of Object.values(a).flat()) {
        assert.ok(item.position.every(Number.isFinite));assert.ok(item.rotation.every(Number.isFinite));assert.ok(item.scale.every(x=>x>0&&Number.isFinite(x)));
      }
    }
  });
  test(`${variant} reduced-effects and lower tiers keep the same composition prefix`, () => {
    const full=woodlandHabitatLayout(variant,'cinematic');
    for (const quality of ['low','medium','high']) {
      const low=woodlandHabitatLayout(variant,quality);
      for (const key of ['plants','litter','timber']) assert.deepEqual(low[key],full[key].slice(0,low[key].length));
      assert.deepEqual(woodlandHabitatLayout(variant,quality,true),woodlandHabitatLayout(variant,'low'));
    }
  });
  test(`${variant} foliage does not cover central walking or water surfaces`, () => {
    const a=woodlandHabitatLayout(variant,'cinematic');
    for(const item of a.plants) {
      const clearance = variant==='blue-moon' ? 10 : 2.7;
      const radius=(variant==='blue-moon'?.47:1.2)*item.scale[0];
      assert.ok(Math.abs(item.position[0])-radius>clearance);
      if(variant==='enchanted-wood')assert.ok(Math.hypot(item.position[0]+4.8,item.position[2]-1.4)-radius>2.75);
    }
    for(const item of a.litter)assert.ok(Math.abs(item.position[0])-.38*item.scale[0]>(variant==='blue-moon'?10:2.7));
  });
}

test('unknown quality falls back safely and reduced effects never adds more detail', () => {
  assert.equal(habitatTier('unknown',false),0);
  for(const quality of ['low','medium','high','cinematic'])assert.equal(habitatTier(quality,true),0);
});

for (const [name, build, max] of [
  ['base fern',()=>createFernGeometry(false),270],['relief fern',()=>createFernGeometry(true),530],
  ['rush',createRushGeometry,120],['litter',createLeafLitterGeometry,24],
  ['deadwood',createDeadwoodGeometry,378],['root threshold',createRootThresholdGeometry,1186],
]) {
  test(`${name} is finite deterministic merged geometry within its triangle budget`, () => {
    const a=build(),b=build();
    try {
      for(const attribute of ['position','normal','uv']) {
        const data=a.getAttribute(attribute);assert.ok(data);assert.deepEqual(data.array,b.getAttribute(attribute).array);
        assert.ok([...data.array].every(Number.isFinite));
      }
      assert.equal(a.groups.length,0);assert.ok(a.index.count/3<=max);assert.ok(a.boundingSphere.radius<6);
    } finally {a.dispose();b.dispose()}
  });
}

test('root threshold leaves a human-scale central passage below the arch', () => {
  const g=createRootThresholdGeometry();
  try {
    const p=g.getAttribute('position');
    for(let i=0;i<p.count;i++)if(p.getY(i)<2.6)assert.ok(Math.abs(p.getX(i))>1.55);
  }finally{g.dispose()}
});

test('crown occlusion is a finite color attribute and keeps the existing triangle budget', () => {
  for(const detail of [0,1,2]) {
    const g=createOrganicCrownGeometry(detail);
    try {
      const c=g.getAttribute('color');assert.equal(c.count,g.getAttribute('position').count);
      for(const n of c.array)assert.ok(n>=.6&&n<=1.04);
      assert.ok(g.index.count/3<=600);
      assert.ok(Math.max(...c.array)-Math.min(...c.array)>.15);
    } finally {g.dispose()}
  }
});

test('every surface finish initializes its roughness term before using it', () => {
  for(const surface of STORY_SURFACES)for(const detail of ['base','relief']) {
    const s=applyTactileShader(template(),surface,detail);
    assert.match(s.fragmentShader,/float authoredRoughness = 0\./);
    assert.ok(s.fragmentShader.indexOf('float authoredRoughness')<s.fragmentShader.indexOf('roughnessFactor + authoredRoughness'));
    assert.match(tactileProgramKey(surface,detail),/-v9-/);
    for(const chunk of ['colorspace_fragment','fog_fragment','normal_fragment_maps'])assert.ok(s.fragmentShader.includes(`#include <${chunk}>`));
  }
});

test('foliage retains standard lighting and uses no transparency or extra render pass', () => {
  for(const relief of [true,false]) {
    const s=applyFoliageFinish(applyTactileShader(template(),'moss',relief?'relief':'base'),relief);
    assert.match(s.fragmentShader,/foliageClump/);assert.match(s.fragmentShader,/fwidth/);
    assert.doesNotMatch(s.fragmentShader,/gl_FragColor\s*=|discard|texture2D/);
  }
  const s=read('src/components/three/environment/FoliageMaterial.tsx');
  assert.doesNotMatch(s,/transparent|opacity=|WebGLRenderTarget|useFrame|TextureLoader/);
});

test('habitat resources dispose independently and introduce no animation or collision', () => {
  const s=read('src/components/three/environment/WoodlandHabitat.tsx');
  for(const x of ['plant.dispose()','litter.dispose()','timber.dispose()','geometry.dispose()','computeBoundingBox()','computeBoundingSphere()'])assert.ok(s.includes(x));
  assert.doesNotMatch(s,/useFrame|RigidBody|Collider|dispatchStoryEvent|localStorage|setInterval|pointLight/);
  assert.match(s,/drawCallBudget: 3/);
});

test('First Wood owner retains root threshold and grounds one guide while Rabbit omits competing path discs', () => {
  const s=read('src/scenes/first-wood/FirstWoodScene.tsx');
  assert.match(s,/isRabbitHole \? <RootThreshold \/>/);assert.doesNotMatch(s,/torusGeometry/);
  assert.match(s,/!isRabbitHole \? <StonePath color="#716756" count=\{11\} length=\{18\}/);
  assert.match(s,/!isRabbitHole \? <FloatingMotes/);
  assert.match(s,/getStoryObject\("enchanted\.guide"\)/);
  assert.match(s,/position=\{rabbitGuideGroundPosition\}[^>]*light=\{false\}/);
  assert.match(s,/<LanternProp position=\{\[0.4, 0.15, 7.6\]\}/);
});

test('replacement rushes remove the earlier untextured stick batch', () => {
  const s=read('src/components/three/environment/EnvironmentDressing.tsx');
  assert.doesNotMatch(s,/name="shoreline-reeds"/);
  assert.match(s,/<WoodlandHabitat variant=\{variant\}/);
  assert.match(s,/drawCallBudget: 7/);
});

test('chapter ground reuses existing compressed art with private transform/disposal and a local fallback', () => {
  const s=read('src/components/three/environment/ChapterGroundMaterial.tsx');
  assert.match(s,/useTexture\("\/textures\/forest\/ground-albedo-v3\.webp"\)/);
  for(const fragment of ['source.clone()', 'THREE.SRGBColorSpace', 'THREE.RepeatWrapping', 'map.dispose()', 'getDerivedStateFromError', '<Suspense fallback={fallback}>'])assert.ok(s.includes(fragment));
  assert.doesNotMatch(s,/source\.dispose|WebGLRenderTarget|useFrame|TextureLoader/);
});

test('only selected forest chapter floors opt into the detailed ground map', () => {
  const source=read('src/components/three/chapters/ChapterPrimitives.tsx');
  assert.match(source,/textured = false/);
  assert.match(read('src/scenes/first-wood/FirstWoodScene.tsx'),/radius=\{16\}[^>]*textured/);
  assert.match(read('src/components/three/chapters/BlueMoonSanctuaryChapter.tsx'),/radius=\{21\}[^>]*textured/);
});

test('canopy leaf mantles retain one material group and the 600 triangle cap', () => {
  for(const detail of [1,2]){
    const g=createOrganicCrownGeometry(detail);
    try {assert.equal(g.groups.length,0);assert.ok(g.index.count/3>500);assert.ok(g.index.count/3<=600);}
    finally{g.dispose()}
  }
});
