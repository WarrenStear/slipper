import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {register} from 'node:module';
import ts from 'typescript';
register(new URL('./canonical-node-loader.mjs',import.meta.url));
const api=Object.assign({},...await Promise.all([
 '../src/data/slipperContent.ts','../src/data/journeyBlueprint.ts','../src/data/journeyWorldLayout.ts',
 '../src/world/terrain/worldPaths.ts','../src/world/terrain/terrainSampler.ts','../src/world/terrain/worldConstants.ts',
 '../src/world/forest/forestConstants.ts','../src/world/forest/forestGeometry.ts','../src/workers/forestWorker.ts',
 '../src/components/three/renderQuality.ts','../src/components/three/worldVisualState.ts',
 '../src/lib/storyJourneyState.ts','../src/storyEvents/storyEventState.ts','../src/storyEvents/storyEventRegistry.ts',
 '../src/lib/narrativeJourneyState.ts','../src/world/forest/forestInstancePresentation.ts',
].map(name=>import(new URL(name,import.meta.url)))));
const paths=api.buildMazePathSegments(api.entries),start=api.getJourneySceneLayout('sunset.stillness').anchor.position,end=api.getJourneySceneLayout('thorned.locked-garden').anchor.position;
const route=paths.find(p=>p.sourceEntry.id===api.getJourneyScene('sunset.stillness').keystoneEntryId&&p.targetEntry.id===api.getJourneyScene('thorned.locked-garden').keystoneEntryId);assert.ok(route);
// Read the real component's worker request, including quality limits and clearing
// exclusions. A hand-built list of ideal trees would miss this regression.
const component=readFileSync(new URL('../src/world/forest/ContinuousForestBed.tsx',import.meta.url),'utf8');
const configSource=ts.createSourceFile('ContinuousForestBed.tsx',component,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),bindings=[];
function visitConfig(node){
 if(ts.isVariableDeclaration(node)&&ts.isIdentifier(node.name)&&node.name.text==='config'&&node.type?.getText(configSource)==='ForestWorkerConfig')bindings.push(node.initializer);
 ts.forEachChild(node,visitConfig);
}
visitConfig(configSource);assert.equal(configSource.parseDiagnostics.length,0);assert.equal(bindings.length,1);assert.ok(ts.isObjectLiteralExpression(bindings[0]));
// Interpret only this data expression; never execute source text or call an
// environment-provided function. Accessors and prototype paths are rejected.
const forbiddenConfigKeys=new Set(['__proto__','prototype','constructor']);
function configDataProperty(object,key){
 assert.ok(!forbiddenConfigKeys.has(key),'Prototype access is outside the config grammar');
 assert.ok(object!==null&&typeof object==='object','Config property needs an own data object');
 const descriptor=Object.getOwnPropertyDescriptor(object,key);
 assert.ok(descriptor&&Object.hasOwn(descriptor,'value'),'Config binding/property must be own data');
 return descriptor.value;
}
function configValue(node,env){
 if(ts.isIdentifier(node))return configDataProperty(env,node.text);
 if(ts.isNumericLiteral(node)){const value=Number(node.text);assert.ok(Number.isFinite(value));return value;}
 if(ts.isPropertyAccessExpression(node)&&!node.questionDotToken)return configDataProperty(configValue(node.expression,env),node.name.text);
 if(ts.isObjectLiteralExpression(node)){
  const result={};
  for(const property of node.properties){
   assert.ok((ts.isPropertyAssignment(property)||ts.isShorthandPropertyAssignment(property))&&ts.isIdentifier(property.name),'Config needs plain named data properties');
   const key=property.name.text;assert.ok(!forbiddenConfigKeys.has(key)&&!Object.hasOwn(result,key),'Config property must be unique and non-prototype');
   if(ts.isShorthandPropertyAssignment(property)){assert.equal(property.objectAssignmentInitializer,undefined);result[key]=configDataProperty(env,key);}
   else result[key]=configValue(property.initializer,env);
  }
  return result;
 }
 if(ts.isCallExpression(node)){
  const callee=node.expression;
  assert.ok(!node.questionDotToken&&ts.isPropertyAccessExpression(callee)&&!callee.questionDotToken&&ts.isIdentifier(callee.expression)&&callee.expression.text==='Math'&&callee.name.text==='min','Only literal Math.min is permitted');
  assert.equal(node.arguments.length,2);assert.equal(node.typeArguments,undefined);
  const values=node.arguments.map(argument=>configValue(argument,env));assert.ok(values.every(value=>typeof value==='number'&&Number.isFinite(value)),'Math.min needs finite numeric data');
  return Math.min(values[0],values[1]);
 }
 assert.fail('Unsupported worker config syntax: '+ts.SyntaxKind[node.kind]);
}
const evaluate=env=>configValue(bindings[0],env);
const contexts=[];let state=api.createFreshStoryJourneyState({fallbackEntryId:'fragment-001',entryProgress:api.JOURNEY_ENTRY_PROGRESS});
for(const scene of api.journeyScenes){
 state={...state,...api.JOURNEY_ENTRY_PROGRESS[scene.keystoneEntryId],sceneId:scene.id,chapterId:scene.chapterId,activeEntryId:scene.keystoneEntryId,storyStarted:true,witnessedEntryIds:[...new Set([...state.witnessedEntryIds,scene.keystoneEntryId])]};
 const send=input=>{const next=api.dispatchStoryEventState(state,input);assert.ok(next.eventIds.length);state=next.state;};
 send({sceneId:scene.id,trigger:'scene-enter'});
 if(scene.id==='thorned.locked-garden'){contexts.push({scene,entry:api.entries.find(e=>e.id===scene.keystoneEntryId),state:structuredClone(state)});break;}
 for(let n=0;!api.isSceneStoryComplete(state)&&n<60;n++){const e=api.getAvailableStoryEvents(state).find(e=>!e.optional);assert.ok(e);send({sceneId:scene.id,eventId:e.id,trigger:e.trigger,objectId:e.objectId,targetId:e.targetId,duration:e.durationMs});}
 assert.ok(api.isSceneStoryComplete(state));
 if(scene.id==='sunset.stillness')contexts.push({scene,entry:api.entries.find(e=>e.id===scene.keystoneEntryId),state:structuredClone(state)});
 state={...state,completedSceneIds:[...new Set([...state.completedSceneIds,scene.id])],history:[...state.history,scene.keystoneEntryId]};
}
assert.equal(contexts.length,2);
function originalFamily(x,z){const qx=Math.round(Math.fround(x)*16),qz=Math.round(Math.fround(z)*16);let hash=Math.imul(qx,0x1f123bb5)^Math.imul(qz,0x5f356495);hash^=hash>>>15;hash=Math.imul(hash,0x2c1b3c6d);hash^=hash>>>12;return(hash>>>0)%api.FOREST_ARCHETYPES.length;}
function population(context,quality,t){
 const narrativeWorldState=api.buildNarrativeWorldState(context.state,{entryById:new Map(api.entries.map(e=>[e.id,e])),totalCount:api.entries.length});
 const at=api.curvedPathPointAt(route,t,narrativeWorldState),qualityProfile=api.RENDER_QUALITY_PROFILES[quality],visualState=api.resolveWorldVisualState({entry:context.entry,narrativeWorldState});
 const config=evaluate({...api,camera:{position:{x:at.x,z:at.y}},qualityProfile,narrativeWorldState,visualState,clearingSeeds:api.packForestClearingSeeds(api.entries),pathSeeds:api.packForestPathSeeds(paths,api.entries),cellX:Math.floor(at.x/api.FOREST_CELL_SIZE),cellZ:Math.floor(at.y/api.FOREST_CELL_SIZE)});
 return api.buildForest({type:'BUILD_FOREST',requestId:1,config});
}
test('House presentation reaches actual surviving trees at early, middle and late route windows in every tier',()=>{
 const identities=new Map();
 for(const context of contexts)for(const quality of ['low','medium','high','cinematic'])for(const t of [.18,.5,.84]){
  const result=population(context,quality,t),label=context.scene.id+'/'+quality+'/'+t,counts=new Map();let changed=0;
  const raw=Buffer.from(result.trunkMatrices.buffer).toString('base64'),colliders=JSON.stringify(result.colliders);
  for(let i=0;i<result.trunkCount;i++){
   const x=result.trunkMatrices[i*16+12],z=result.trunkMatrices[i*16+14],before=originalFamily(x,z),after=api.forestArchetypeAtWorldPosition(x,z),key=x+','+z;
   assert.equal(after,api.forestArchetypeAtWorldPosition(Math.fround(x),Math.fround(z)));
   if(identities.has(key))assert.equal(after,identities.get(key),'Packing and tier must not change a tree identity');identities.set(key,after);
   if(before!==after){changed++;assert.equal(after,1);assert.ok(api.houseApproachRhythmAtWorldPosition(x,z)>0);}
   counts.set(after,(counts.get(after)||0)+1);
  }
  assert.ok(changed>0,label+' must not silently lose its entire presentation change');
  assert.ok(changed<result.trunkCount/2,label+' retains irregular companions');
  assert.ok(counts.size>=3,label+' retains at least three existing silhouette families');
  assert.ok((counts.get(1)||0)<result.trunkCount*.75,label+' is not a uniform timber wall');
  assert.equal(Buffer.from(result.trunkMatrices.buffer).toString('base64'),raw);assert.equal(JSON.stringify(result.colliders),colliders);
 }
});
test('clearing-flank rhythm rises gradually along the authored axis and smoothly fades outside its local field',()=>{
 const dx=end[0]-start[0],dz=end[2]-start[2],length=Math.hypot(dx,dz),at=(t,lateral)=>[start[0]+dx*t+dz/length*lateral,start[2]+dz*t-dx/length*lateral];
 for(const lateral of [0,8,16,24]){
  let prior=0;
  for(let i=0;i<=100;i++){const value=api.houseApproachRhythmAtWorldPosition(...at(i/100,lateral));assert.ok(value>=prior-1e-12&&value<=1);assert.ok(value-prior<.04,'No abrupt field step');prior=value;}
  assert.ok(prior>0,'Surviving flanks share the field');
  for(let i=101;i<=135;i++){const value=api.houseApproachRhythmAtWorldPosition(...at(i/100,lateral));assert.ok(value<=prior+1e-12&&value>=0);prior=value;}
  assert.ok(prior<1e-12);
 }
 for(const [t,lateral]of [[-.01,0],[1.36,0],[.5,29],[.8,-29]]){const p=at(t,lateral);assert.equal(api.houseApproachRhythmAtWorldPosition(...p),0);assert.equal(api.forestArchetypeAtWorldPosition(...p),originalFamily(...p));}
});

test('worker config reader accepts only its closed data grammar and never invokes accessors or arbitrary calls',()=>{
 const parse=expression=>{const ast=ts.createSourceFile('config.ts','const config = '+expression,ts.ScriptTarget.Latest,true,ts.ScriptKind.TS);assert.equal(ast.parseDiagnostics.length,0);return ast.statements[0].declarationList.declarations[0].initializer;};
 const env={limit:4,profile:{radius:3},camera:{position:{x:12.5}},cellX:2,clearingSeeds:[{radius:7.2}]};
 assert.deepEqual(configValue(parse('{radius: Math.min(limit, profile.radius), x: camera.position.x, cellX, clearings: clearingSeeds, cap: 16}'),env),{radius:3,x:12.5,cellX:2,clearings:env.clearingSeeds,cap:16});
 let reads=0;const accessor=Object.defineProperty({},'radius',{get(){reads++;return 3;}});
 assert.throws(()=>configValue(parse('{radius: profile.radius}'),{profile:accessor}));assert.equal(reads,0);
 for(const expression of ['{radius: Math.max(limit, 3)}','{radius: profile.read()}','{radius: missing}','{radius: camera["position"]}','{radius: camera.constructor}','{radius: limit + 1}','{...profile}','{get radius(){return 3}}','{radius: 1, radius: 2}'])assert.throws(()=>configValue(parse(expression),env),expression);
 assert.throws(()=>configValue(parse('{radius: Math.min(limit, profile.radius)}'),{...env,limit:Infinity}));
 assert.throws(()=>configValue(parse('{radius: inherited}'),Object.create({inherited:3})));
});
