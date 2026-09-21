import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { FLOOR_MASK_SIZE, floorBrush, beginFloorStroke, breakFloorStroke, brushFloor, cancelFloorStroke, floorStrokeReady, resetFloorBrush } from '../src/components/three/storyEvents/storyInteractionRuntime.ts';
import { createReflectionHistory, recordReflectionPose, sampleReflectionPose, resetReflectionHistory, houseResetDuration, smoothPresentationProgress } from '../src/lib/scenePolishRuntime.ts';
const pose = x => ({x, y:x * 2, yaw:x / 10});
const out = () => ({x:0,y:0,yaw:0});

test('a sweep has measurable surface coverage, not just cursor distance', () => {
  resetFloorBrush(); beginFloorStroke();
  for (let i=0;i<=10;i++) brushFloor(.35+i*.012,.5);
  assert.equal(floorStrokeReady(),true);
  assert.ok(floorBrush.coverage.some(value => value > 200));
});
test('a tap and stationary jitter cannot finish a floor wipe', () => {
  resetFloorBrush(); beginFloorStroke(); brushFloor(.5,.5);
  assert.equal(floorStrokeReady(),false);
  for (let i=0;i<500;i++) brushFloor(.5+(i%2)*.001,.5);
  assert.equal(floorStrokeReady(),false);
});
test('a second deliberate stroke is required even over an already cleared area', () => {
  resetFloorBrush(); beginFloorStroke(); brushFloor(.3,.5); brushFloor(.5,.5);
  assert.equal(floorStrokeReady(),true); cancelFloorStroke();
  assert.equal(floorStrokeReady(),false); beginFloorStroke();
  assert.equal(floorStrokeReady(),false);
  brushFloor(.3,.5); brushFloor(.5,.5); assert.equal(floorStrokeReady(),true);
});
test('coverage survives more than twenty-four brush samples', () => {
  resetFloorBrush(); brushFloor(.15,.15);
  const index=Math.floor(.15*FLOOR_MASK_SIZE)*FLOOR_MASK_SIZE+Math.floor(.15*FLOOR_MASK_SIZE);
  const before=floorBrush.coverage[index]; assert.ok(before>0);
  for(let i=0;i<200;i++) brushFloor(.8,.8);
  assert.equal(floorBrush.coverage[index],before);
  assert.equal(floorBrush.coverage.length,4096); assert.equal(floorBrush.points.length,48);
});
test('long strokes are interpolated without erasing earlier coverage', () => {
  resetFloorBrush(); beginFloorStroke(); brushFloor(.1,.5); brushFloor(.9,.5);
  for(const x of [.2,.4,.6,.8]) assert.ok(floorBrush.coverage[32*64+Math.floor(x*64)]>100);
});
test('leaving the floor does not paint the intervening gap', () => {
  resetFloorBrush(); beginFloorStroke(); brushFloor(.1,.5); breakFloorStroke(); brushFloor(.9,.5);
  assert.equal(floorBrush.coverage[32*64+32],0);
  assert.equal(floorStrokeReady(),false);
});
test('invalid texture coordinates are rejected without poisoning the mask', () => {
  resetFloorBrush(); beginFloorStroke();
  for(const value of [NaN,Infinity,-1,2]) {brushFloor(value,.5);brushFloor(.5,value);}
  assert.equal(floorBrush.count,0); assert.equal(floorStrokeReady(),false);
  assert.equal(floorBrush.coverage.some(Boolean),false);
});
test('fresh reset clears all transient coverage without replacing buffers', () => {
  const buffer=floorBrush.coverage; beginFloorStroke(); brushFloor(.3,.4);brushFloor(.5,.4);
  resetFloorBrush(); assert.equal(floorBrush.coverage,buffer);
  assert.equal(buffer.some(Boolean),false); assert.equal(floorStrokeReady(),false);
});
test('strokes at the texture boundary remain bounded', () => {
  resetFloorBrush(); beginFloorStroke(); brushFloor(0,0); brushFloor(.2,0);brushFloor(1,1);
  assert.equal(floorBrush.coverage.length,4096);
  assert.ok(floorBrush.coverage[0]>0);assert.ok(floorBrush.coverage[4095]>0);
});
test('delayed reflection samples the actual historical pose', () => {
  const h=createReflectionHistory(), result=out();
  for(let t=0;t<=1500;t+=100)recordReflectionPose(h,t,pose(t/100));
  assert.equal(sampleReflectionPose(h,1500,800,result),true);
  assert.deepEqual(result,pose(7));
});
test('reflection interpolates movement instead of switching between frames', () => {
  const h=createReflectionHistory(), result=out();
  recordReflectionPose(h,1000,pose(0));recordReflectionPose(h,1100,pose(2));
  sampleReflectionPose(h,1850,800,result); assert.equal(result.x,1); assert.equal(result.y,2);
});
test('reflection angle interpolation takes the short arc across pi', () => {
  const h=createReflectionHistory(), result=out();
  recordReflectionPose(h,0,{x:0,y:0,yaw:Math.PI-.1});
  recordReflectionPose(h,100,{x:0,y:0,yaw:-Math.PI+.1});
  sampleReflectionPose(h,50,0,result);assert.ok(Math.abs(Math.abs(result.yaw)-Math.PI)<1e-9);
});
test('reflection warm-up holds the first witnessed pose', () => {
  const h=createReflectionHistory(), result=out();recordReflectionPose(h,500,pose(3));
  sampleReflectionPose(h,550,800,result);assert.deepEqual(result,pose(3));
});
test('reflection converges to stillness after the delay', () => {
  const h=createReflectionHistory(), result=out();
  recordReflectionPose(h,0,pose(0));
  for(let t=100;t<=1800;t+=100)recordReflectionPose(h,t,pose(4));
  sampleReflectionPose(h,1800,800,result);assert.deepEqual(result,pose(4));
});
test('history memory is bounded during long sessions', () => {
  const h=createReflectionHistory(), result=out();
  for(let i=0;i<10000;i++)recordReflectionPose(h,i*40,pose(i));
  assert.equal(h.count,128);assert.equal(h.data.length,512);
  sampleReflectionPose(h,9999*40,800,result);assert.equal(result.x,9979);
});
test('suspension and backwards clocks restart reflection history safely', () => {
  const h=createReflectionHistory(), result=out();
  recordReflectionPose(h,0,pose(1));recordReflectionPose(h,100,pose(2));
  recordReflectionPose(h,10000,pose(5));assert.equal(h.count,1);
  sampleReflectionPose(h,10000,800,result);assert.equal(result.x,5);
  recordReflectionPose(h,100,pose(7));assert.equal(h.count,1);
});
test('bad samples and repeated same-frame writes do not enter the reflection buffer', () => {
  const h=createReflectionHistory();recordReflectionPose(h,0,pose(1));
  recordReflectionPose(h,0,pose(2));recordReflectionPose(h,10,pose(3));
  recordReflectionPose(h,100,pose(NaN));recordReflectionPose(h,Infinity,pose(4));
  assert.equal(h.count,1);
});
test('empty and reset reflection histories cannot fabricate an observation', () => {
  const h=createReflectionHistory(), result=out();assert.equal(sampleReflectionPose(h,0,800,result),false);
  recordReflectionPose(h,0,pose(1));resetReflectionHistory(h);assert.equal(h.count,0);
  assert.equal(sampleReflectionPose(h,0,800,result),false);
});
test('zero delay reproduces the latest pose', () => {
  const h=createReflectionHistory(), result=out();recordReflectionPose(h,0,pose(1));recordReflectionPose(h,100,pose(3));
  sampleReflectionPose(h,100,0,result);assert.deepEqual(result,pose(3));
});
test('only a newly undone house placement animates', () => {
  for(const id of ['thorn-house.chair','thorn-house.frame']) assert.equal(houseResetDuration(id,'placed','reset',false),2.4);
  assert.equal(houseResetDuration('lantern.master','placed','reset',false),0);
  assert.equal(houseResetDuration('thorn-house.chair','resting','reset',false),0);
});
test('reload and reduced motion restore the final house pose without replay', () => {
  assert.equal(houseResetDuration('thorn-house.chair','reset','reset',false),0);
  assert.equal(houseResetDuration('thorn-house.chair',undefined,'reset',false),0);
  assert.equal(houseResetDuration('thorn-house.chair','placed','reset',true),0);
});
test('house pose easing stays bounded and reaches the authored destination', () => {
  assert.equal(smoothPresentationProgress(-1,2.4),0);assert.equal(smoothPresentationProgress(1.2,2.4),.5);
  assert.equal(smoothPresentationProgress(2.4,2.4),1);assert.equal(smoothPresentationProgress(999,2.4),1);
  assert.equal(smoothPresentationProgress(0,0),1);assert.equal(smoothPresentationProgress(NaN,2.4),0);
});
test('the renderer consumes coverage and viewer history rather than free-running reflection motion', () => {
  const text=p=>readFileSync(new URL(p,import.meta.url),'utf8');
  assert.match(text('../src/components/three/storyEvents/WetFloorReveal.tsx'),/texture2D\(coverageMask,vUv\)/);
  const mirror=text('../src/components/three/storyEvents/ObservedSanctuaryReflection.tsx');
  assert.match(mirror,/recordReflectionPose\(history, now, pose\)/);assert.match(mirror,/sampleReflectionPose/);
  assert.match(mirror,/<ReflectivePanel position=\{\[0, 0, 0\]\}/);
  assert.match(mirror,/rotation=\{\[0, Math\.PI, 0\]\}/);
  assert.doesNotMatch(mirror,/clock\.elapsedTime/);
  assert.match(text('../src/components/three/chapters/BlueMoonSanctuaryChapter.tsx'),/worldAnchored: true/);
});

// A 0.02 UV sweep is about 25 cm on the authored 12.8 m floor.
// Exercise sub-texel offsets: quantisation must not demand an oversized gesture.
test('natural close-camera hand sweeps clear enough surface at different texel offsets', () => {
  for (let x=0;x<10;x++) for (let y=0;y<10;y++) for (const direction of [-1,1]) {
    resetFloorBrush(); beginFloorStroke();
    for (let i=0;i<=10;i++) brushFloor(.48+x*.00156+direction*.02*i/10,.38+y*.00156);
    assert.equal(floorStrokeReady(),true,`offset ${x},${y}; direction ${direction}`);
  }
});
