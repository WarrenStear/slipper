import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { Vector3, Euler } from 'three';
import { FIRE_SOURCE_LOCAL_POSITION, firePathPlacement } from '../src/components/three/chapters/firePathLayout.ts';
import { STORY_OBJECTS } from '../src/storyEvents/chapterStoryEvents.ts';

test('the active material fire sits on the fixed story fire footprint while inactive fork geography stays left', () => {
  const semantic = STORY_OBJECTS.find(object => object.id === 'fire.flame');
  const active = firePathPlacement(true);
  const position = new Vector3(...FIRE_SOURCE_LOCAL_POSITION).applyEuler(new Euler(...active.rotation)).add(new Vector3(...active.position));
  assert.equal(position.x, semantic.localPosition[0]);
  assert.equal(position.z, semantic.localPosition[2]);
  assert.equal(position.y, 0, 'logs and ash rest on the walk surface under the interaction anchor');
  assert.deepEqual(semantic.localPosition, [0, .25, 4]);
  const inactive = firePathPlacement(false);
  assert.deepEqual(inactive, { position: [-5.8, 0, .8], rotation: [0, -.36, 0] });
});

test('the boundary chapter owns one fire image and retains the generic semantic object pose', () => {
  const director = readFileSync(new URL('../src/components/three/storyEvents/StoryEventDirector.tsx', import.meta.url), 'utf8');
  assert.match(director, /sceneId === "fire\.boundary" && object\.id === "fire\.flame"/);
  assert.match(director, /<StoryObjectPose[^>]+object=\{object\}[^>]+position=\{location\}/);
  assert.match(director, /chapterOwnsVisual \? null : <StoryObjectModel/);
  const path = readFileSync(new URL('../src/components/three/chapters/FirePath.tsx', import.meta.url), 'utf8');
  assert.equal((path.match(/<BoundaryFire /g) ?? []).length, 1);
  assert.doesNotMatch(path, /RigidBody|Collider/);
});
