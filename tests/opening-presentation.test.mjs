import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  openingStage, openingPhase, openingRoomTarget, openingMotionDelta,
  openingEnclosed, createOpeningPointerHandoff, beginOpeningPointer,
  resetOpeningPointer, consumeOpeningClick,
} from '../src/cinematics/openingPresentation.ts';
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('fresh and each restored opening state map to distinct presentation stages', () => {
  assert.equal(openingStage(undefined, []), 0);
  assert.equal(openingStage('clear-patch', ['broken-floor.first-wipe']), 1);
  assert.equal(openingStage('revealed', ['broken-floor.first-wipe']), 2);
  assert.equal(openingStage('inverted', []), 3);
  assert.equal(openingStage(undefined, [], true), 3);
  assert.deepEqual([0,1,2,3].map(openingPhase), ['room','first-reveal','forest-revealed','entered']);
});
test('presentation cannot infer wipes from unrelated completed events', () => {
  const events = ['blue-moon.candle-chain'];
  assert.equal(openingStage(undefined, events), 0);
  assert.deepEqual(events, ['blue-moon.candle-chain']);
});
test('restored room pose is derived directly from its accepted stage', () => {
  assert.deepEqual([0,1,2,3].map(openingRoomTarget), [0,.2,.4,1]);
  assert.equal(openingRoomTarget(NaN), 0);
  assert.equal(openingRoomTarget(-1), 0);
  assert.equal(openingRoomTarget(20), 1);
});
test('reduced motion snaps rather than accelerating involuntary room motion', () => {
  assert.match(source('src/world/opening/openingComposition.ts'), /reducedMotion && active \? target/);
});
test('paused room cannot accrue presentation time', () => {
  for (const delta of [0, 1/60, .2, 100]) assert.equal(openingMotionDelta(delta, false), 0);
});
test('invalid frame durations do not advance the room', () => {
  for (const delta of [NaN,Infinity,-Infinity,-1,0]) assert.equal(openingMotionDelta(delta,true),0);
});
test('stalled but active frames are clamped without freezing or fast-forwarding the room', () => {
  for (const delta of [.251,.5,20]) assert.equal(openingMotionDelta(delta,true),.05);
});
test('normal witnessed frame deltas are bounded without changing the authored damping formula', () => {
  assert.equal(openingMotionDelta(1/60,true),1/60);
  assert.equal(openingMotionDelta(.25,true),.05);
  assert.match(source('src/world/opening/openingComposition.ts'), /MathUtils\.damp\(previous, target, 3 \/ 8, openingMotionDelta/);
});
test('only the unresolved Broken Floor owns the enclosed presentation', () => {
  assert.equal(openingEnclosed('broken-floor.confession',false),true);
  assert.equal(openingEnclosed('broken-floor.confession',true),false);
  for (const id of [undefined,null,'enchanted.rabbit-hole','blue-moon.intimacy']) assert.equal(openingEnclosed(id,false),false);
});
test('opening clicks are not also click-to-lock gestures', () => {
  const state=createOpeningPointerHandoff();beginOpeningPointer(state,true);
  assert.equal(consumeOpeningClick(state,true),true);
});
test('the inversion pointer keeps ownership of its trailing click after progression changes', () => {
  const state=createOpeningPointerHandoff();beginOpeningPointer(state,true);
  assert.equal(consumeOpeningClick(state,false),true);
  assert.equal(consumeOpeningClick(state,false),false);
});
test('the next deliberate forest click is handed back to mouse look', () => {
  const state=createOpeningPointerHandoff();beginOpeningPointer(state,true);
  consumeOpeningClick(state,false);beginOpeningPointer(state,false);
  assert.equal(consumeOpeningClick(state,false),false);
});
test('cancelled input leaves no stale click ownership', () => {
  const state=createOpeningPointerHandoff();beginOpeningPointer(state,true);resetOpeningPointer(state);
  assert.equal(consumeOpeningClick(state,false),false);
  assert.equal(consumeOpeningClick(state,true),true);
});
test('click boundary preserves pointer input and cleans up global listeners', () => {
  const text=source('src/components/three/journey/OpeningInteractionBoundary.tsx');
  assert.match(text,/addEventListener\("click", click, true\)/);
  assert.match(text,/removeEventListener\("click", click, true\)/);
  assert.match(text,/event\.stopImmediatePropagation\(\)/);
  assert.doesNotMatch(text,/preventDefault|dispatchStoryEvent|setState|\.quaternion|\.position/);
  for (const event of ['pointercancel','blur','pagehide','pointerlockchange']) {
    assert.ok(text.includes(`addEventListener("${event}"`));
    assert.ok(text.includes(`removeEventListener("${event}"`));
  }
});
test('photograph and coverage use distinct colour interpretations without changing the source asset', () => {
  const text=source('src/world/opening/WetFloorReveal.tsx') + source('src/world/opening/wetFloorResources.ts') + source('src/world/opening/wetFloorShader.ts');
  assert.match(text,/source\.clone\(\)/);assert.match(text,/texture\.colorSpace = THREE\.SRGBColorSpace/);
  assert.match(text,/THREE\.RedFormat/);assert.match(text,/#include <colorspace_fragment>/);
  assert.match(text,/toneMapped=\{false\}/);assert.match(text,/forest\.dispose\(\)/);
  assert.match(text,/useTexture\("\/story-materials\/forest-reflection\.jpg"\)/);
  assert.match(text,/planeGeometry args=\{\[12\.8, 12\.5\]\}/);
});
test('rendered-stage readiness is published by an actual draw callback, not a timer', () => {
  const text=source('src/world/opening/WetFloorReveal.tsx');
  assert.match(text,/onAfterRender=\{recordRenderedStage\}/);
  assert.match(text,/Math\.abs\(uniforms\.stage\.value - stage\)/);
  assert.doesNotMatch(text,/dispatchStoryEvent|setTimeout|setInterval/);
});
test('opening work keeps one authored chapter and batches the original boards', () => {
  const chapter=source('src/scenes/broken-floor/BrokenFloorScene.tsx');
  assert.match(chapter,/useRef\(openingRoomTarget\(revealStage\)\)/);
  assert.match(chapter,/OpeningFloorboards count=\{plankCount\}/);
  assert.match(chapter,/computeBoundingBox\(\)/);assert.match(chapter,/computeBoundingSphere\(\)/);
  assert.match(chapter,/name="forest-beneath-wet-reflection" visible=\{revealStage >= 3\}/);
  assert.doesNotMatch(chapter,/dispatchStoryEvent|setScene|setInterval/);
});

// Sound is an effect of accepted events; hydration keeps prior events silent.
test('the opening distinguishes first contact and revealed water without awarding progress', async () => {
  const { resolveStoryEventAudioCue, newAudibleStoryEvents } = await import('../src/components/three/audio/storyEventAudio.ts');
  assert.equal(resolveStoryEventAudioCue('broken-floor.first-wipe').material, 'cloth');
  assert.equal(resolveStoryEventAudioCue('broken-floor.forest-revealed').material, 'water');
  const ids=['broken-floor.first-wipe','broken-floor.forest-revealed'];
  assert.deepEqual(newAudibleStoryEvents(new Set(ids),ids), []);
  assert.deepEqual(newAudibleStoryEvents(new Set(ids.slice(0,1)),ids), ids.slice(1));
});
