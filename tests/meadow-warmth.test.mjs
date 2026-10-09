import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {Color} from 'three';
import {resolveSceneLook} from '../src/components/three/artDirection/SceneLookRegistry.ts';
import {journeyScenes,JOURNEY_ENTRY_PROGRESS} from '../src/data/journeyBlueprint.ts';
import {createFreshStoryJourneyState} from '../src/lib/storyJourneyState.ts';
import {dispatchStoryEventState} from '../src/storyEvents/storyEventState.ts';
const require=createRequire(import.meta.url),ts=require('typescript');
const owner=readFileSync(new URL('../src/components/three/artDirection/SceneLookDirector.tsx',import.meta.url),'utf8');
const ast=ts.createSourceFile('SceneLookDirector.tsx',owner,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let binding;
function visit(n){if(ts.isPropertyAssignment(n)&&n.name.getText(ast)==='meadowRested')binding=n.initializer;ts.forEachChild(n,visit);}
visit(ast);assert.ok(binding,'The actual existing SceneLook owner must pass the persisted outcome');
// Read the owner's closed equality expression without executing generated code.
assert.ok(ts.isBinaryExpression(binding));
assert.equal(binding.operatorToken.kind,ts.SyntaxKind.EqualsEqualsEqualsToken);
assert.ok(ts.isElementAccessExpression(binding.left));
assert.ok(ts.isIdentifier(binding.left.expression));
assert.equal(binding.left.expression.text,'objects');
assert.ok(ts.isStringLiteral(binding.left.argumentExpression));
assert.ok(ts.isStringLiteral(binding.right));
const restedFromOwner=objects=>objects[binding.left.argumentExpression.text]===binding.right.text;
const meadow=(objects,quality='high',effects=false)=>resolveSceneLook('enchanted.friendship-meadow',quality,effects,{meadowRested:restedFromOwner(objects)});
test('actual accepted Meadow stillness drives the existing owner; insufficient attention does not',()=>{
 const scene=journeyScenes.find(s=>s.id==='enchanted.friendship-meadow');
 let state={...createFreshStoryJourneyState({fallbackEntryId:'fragment-001',entryProgress:JOURNEY_ENTRY_PROGRESS}),sceneId:scene.id,chapterId:scene.chapterId,activeEntryId:scene.keystoneEntryId};
 state=dispatchStoryEventState(state,{sceneId:scene.id,trigger:'scene-enter'}).state;
 const input={sceneId:scene.id,eventId:'enchanted.meadow-warmth',objectId:'enchanted.rest',trigger:'stillness'};
 const denied=dispatchStoryEventState(state,{...input,duration:1000});assert.deepEqual(denied.eventIds,[]);
 const before=meadow(denied.state.storyObjectStates);
 const accepted=dispatchStoryEventState(state,{...input,duration:2600});assert.ok(accepted.eventIds.includes(input.eventId));assert.equal(accepted.state.storyObjectStates['enchanted.rest'],'witnessed');
 const after=meadow(accepted.state.storyObjectStates);assert.notEqual(after.lighting.color,before.lighting.color);assert.equal(after.lighting.color,'#e3d0ac');assert.deepEqual(dispatchStoryEventState(accepted.state,{...input,duration:2600}).eventIds,[]);
});
test('only exact witnessed state warms Meadow; other persisted objects and non-boolean look inputs do not',()=>{
 const normal=meadow({});
 for(const value of [undefined,null,false,true,0,1,'idle','resting','placed','complete'])assert.deepEqual(meadow({'enchanted.rest':value}),normal);
 assert.deepEqual(meadow({'river.white-fabric':'raised','enchanted.hearth':'lit'}),normal);
 for(const value of [undefined,null,false,0,1,'witnessed'])assert.deepEqual(resolveSceneLook('enchanted.friendship-meadow','high',false,{meadowRested:value}),normal);
});
test('all32 scenes and allquality/effects profiles retain exact other light, budget, atmosphere, motion and material values',()=>{
 for(const scene of journeyScenes)for(const quality of ['low','medium','high','cinematic'])for(const effects of [false,true]){
  const normal=resolveSceneLook(scene.id,quality,effects),rested=resolveSceneLook(scene.id,quality,effects,{meadowRested:true});const expected=structuredClone(normal);if(scene.id==='enchanted.friendship-meadow')expected.lighting.color='#e3d0ac';assert.deepEqual(rested,expected,scene.id+' '+quality+' '+effects);
 }
});
test('warmth is a bounded ordinary incident-light tint with no intensity or emission increase',()=>{
 const normal=meadow({}),rested=meadow({'enchanted.rest':'witnessed'}),a=new Color(normal.lighting.color),b=new Color(rested.lighting.color);
 assert.ok(b.r/b.b>a.r/a.b);assert.ok([b.r,b.g,b.b].every(v=>Number.isFinite(v)&&v>=0&&v<=1));assert.equal(rested.lighting.intensity,normal.lighting.intensity);assert.equal(rested.lighting.fillFloor,normal.lighting.fillFloor);assert.deepEqual(rested.lighting.position,normal.lighting.position);assert.deepEqual(rested.budget,normal.budget);assert.deepEqual(rested.palette,normal.palette);
});
