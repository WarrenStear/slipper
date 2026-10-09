import assert from 'node:assert/strict';
import test from 'node:test';
import { register } from 'node:module';
register('./canonical-node-loader.mjs',import.meta.url);
register('./quiet-tsx-loader.mjs',import.meta.url);
const { deriveConstellationMemory, constellationEntryAction }=await import('../src/components/ui/ConstellationMap.tsx');
const { deriveConstellationPresentation }=await import('../src/components/ui/ConstellationMap.tsx');
const geometry=await import('../src/components/ui/ConstellationMap.tsx');
const { buildStoryConstellationModel }=await import('../src/lib/lanternNarrative.ts');
const { entries }=await import('../src/data/slipperContent.ts');
const { journeyScenes,journeyChapters }=await import('../src/data/journeyNarrative.ts');
const ids=entries.map(entry=>entry.id);
const state=patch=>({activeEntryId:ids[0],history:[],witnessedEntryIds:[],completedRitualIds:[],completedChapterIds:[],completedSceneIds:[],
  resonances:{wolf:0,swan:0,seer:0},releasedWords:[],landmarkStates:{},...patch});
function freeze(value){if(value&&typeof value==='object'){Object.freeze(value);for(const child of Object.values(value))freeze(child);}return value;}
const frame=(memory,patch={})=>deriveConstellationPresentation({memory,entries,activeEntryId:ids[0],visitedEntryIds:ids,
  scope:'full',breadcrumbTraces:[],...patch});

test('frozen visited/history/completed state exposes zero named memories until canonical witnesses exist in either scope',()=>{
  const snapshot=freeze(state({history:ids,visitedEntryIds:ids,completedSceneIds:journeyScenes.map(scene=>scene.id),completedChapterIds:journeyChapters.map(chapter=>chapter.id)}));
  const before=JSON.stringify(snapshot),memory=deriveConstellationMemory(snapshot);
  assert.equal(memory.nodes.length,0);assert.equal(memory.edges.length,0);assert.equal(memory.chapters.length,0);assert.equal(memory.growth,'dark');
  assert.equal(memory.protectedNest.visible,false);assert.deepEqual(memory.protectedNest.entryIds,[]);
  for(const scope of ['full','witnessed-only']){
    const presentation=frame(memory,{scope});assert.equal(presentation.activeEntry,undefined);assert.equal(presentation.activeChapter,undefined);
    assert.equal(presentation.nodeMap.size,0);assert.equal(presentation.listedEntries.length,0);assert.equal(presentation.anonymousPoints.length,66);
    const output=JSON.stringify(presentation);for(const entry of entries)assert.equal(output.includes(entry.title),false,entry.id);
  }
  assert.equal(JSON.stringify(snapshot),before);
});

test('canonical edges, repeated crossings and interrupted actual route segments survive without bridging unwitnessed memories',()=>{
  const snapshot=freeze(state({activeEntryId:'fragment-010',history:['fragment-001','fragment-008','fragment-003','fragment-008'],
    witnessedEntryIds:['fragment-001','fragment-008','fragment-010','unknown'],completedSceneIds:journeyScenes.map(scene=>scene.id)}));
  const canonical=buildStoryConstellationModel(snapshot),memory=deriveConstellationMemory(snapshot);
  const watched=new Set(['fragment-001','fragment-008','fragment-010']);
  assert.deepEqual(memory.edges,canonical.edges.filter(edge=>watched.has(edge.sourceEntryId)&&watched.has(edge.targetEntryId)));
  assert.deepEqual(memory.routeSegments,[['fragment-001','fragment-008'],['fragment-008','fragment-010']]);
  assert.equal(memory.progress.routeSteps,2);assert.equal(memory.nodes.length,3);assert.equal(memory.progress.witnessedEntries,3);
  const repeated=deriveConstellationMemory(state({activeEntryId:'fragment-001',history:['fragment-001','fragment-008','fragment-001','fragment-008'],witnessedEntryIds:['fragment-001','fragment-008']}));
  assert.equal(repeated.edges[0].traversalCount,4);assert.equal(repeated.progress.routeSteps,4);
});

test('all66 witnessed memories retain the full connected canonical authored relationship graph and individual titles',()=>{
  const snapshot=freeze(state({activeEntryId:ids.at(-1),history:ids.slice(0,-1),witnessedEntryIds:ids,
    completedSceneIds:journeyScenes.map(scene=>scene.id),completedChapterIds:journeyChapters.map(chapter=>chapter.id)}));
  const canonical=buildStoryConstellationModel(snapshot),memory=deriveConstellationMemory(snapshot),presentation=frame(memory,{activeEntryId:ids.at(-1)});
  assert.equal(memory.nodes.length,66);assert.deepEqual(memory.edges,canonical.edges);assert.equal(memory.growth,'whole');
  const reached=new Set([ids[0]]);let changed=true;while(changed){changed=false;for(const edge of memory.edges){
    if(reached.has(edge.sourceEntryId)&&!reached.has(edge.targetEntryId)){reached.add(edge.targetEntryId);changed=true;}
    if(reached.has(edge.targetEntryId)&&!reached.has(edge.sourceEntryId)){reached.add(edge.sourceEntryId);changed=true;}
  }}assert.equal(reached.size,66);assert.equal(presentation.listedEntries.length,66);assert.equal(presentation.anonymousPoints.length,0);
  for(const node of presentation.nodeMap.values())assert.deepEqual(Object.keys(node.entry).sort(),['chapter','id','title']);
});

test('unread full guidance is opaque, stale proximity is ignored, and all breadcrumb/title output is witnessed',()=>{
  const memory=deriveConstellationMemory(state({witnessedEntryIds:[ids[0],ids[7]],history:[ids[0],ids[7]]}));
  const traces=ids.map((id,index)=>({id:`private-${id}`,activeEntryId:id,position:[index,0,index],kind:'footprint',scale:1,intensity:1}));
  const presentation=frame(memory,{breadcrumbTraces:traces,sceneProximity:{activeEntryId:ids[0],navigationTargetId:ids[20],playerPosition:[0,0,0],cameraYaw:0}});
  assert.equal(presentation.targetNode.entry.id,ids[20]);assert.equal(presentation.targetNode.entry.title,'Unread memory');
  assert.equal(presentation.targetWitnessed,false);assert.equal(presentation.breadcrumbDots.length,2);
  for(const point of presentation.anonymousPoints)assert.deepEqual(Object.keys(point).sort(),['x','y']);
  for(const entry of entries.filter(entry=>![ids[0],ids[7]].includes(entry.id)))assert.equal(JSON.stringify(presentation).includes(entry.title),false,entry.id);
  const partial=frame(memory,{scope:'witnessed-only',sceneProximity:{activeEntryId:ids[0],navigationTargetId:ids[20]}});assert.equal(partial.targetNode,undefined);
  const stale=frame(memory,{scope:'witnessed-only',sceneProximity:{activeEntryId:ids[1],navigationTargetId:ids[7]}});assert.equal(stale.targetNode,undefined);
});

test('growth/light state follows canonical witnessed transformations; no absent integration or fire chapter glyph can appear',()=>{
  const one=deriveConstellationMemory(state({witnessedEntryIds:[ids[0]],resonances:{wolf:100,swan:100,seer:100},releasedWords:['fear']}));
  assert.equal(one.growth,'spark');assert.ok(one.resonanceNodes.every(node=>!node.visible));assert.deepEqual(one.releasedWords,[]);
  const integratedIds=journeyChapters.find(chapter=>chapter.id==='wolf-swan-seer').entryIds;
  const fireIds=journeyChapters.find(chapter=>chapter.id==='fire-river').entryIds;
  const earned=deriveConstellationMemory(state({witnessedEntryIds:[...integratedIds,...fireIds],resonances:{wolf:100,swan:50,seer:20},releasedWords:['fear','hope']}));
  assert.ok(earned.resonanceNodes.every(node=>node.visible));assert.deepEqual(earned.releasedWords,['fear','hope']);
  const transformed=deriveConstellationMemory(state({witnessedEntryIds:[ids[0]],completedSceneIds:['broken-floor.confession']}));
  assert.ok(transformed.nodes[0].intensity>one.nodes[0].intensity);
});

test('entry action policy uses witnesses rather than visits, with only anonymous full guidance for unread canonical IDs',()=>{
  assert.equal(constellationEntryAction(ids[7],[], 'full',true,true),'guide');
  assert.equal(constellationEntryAction(ids[7],[], 'witnessed-only',true,true),null);
  assert.equal(constellationEntryAction(ids[7],[ids[7]],'full',true,true),'open');
  assert.equal(constellationEntryAction('unknown',['unknown'],'full',true,true),null);
  assert.equal(constellationEntryAction(ids[7],[ids[7]],'full',false,true),null);
});

test('pure pan/zoom keeps pointer anchoring, bounded scale, numeric paths and frozen inputs without mutation',()=>{
  const initial=freeze({x:12,y:-4,scale:1.7}),point=freeze({x:130,y:230});
  const zoom=geometry.constellationZoomAt(initial,point,-250);
  assert.ok(Math.abs((point.x-initial.x)/initial.scale-(point.x-zoom.x)/zoom.scale)<1e-12);
  assert.equal(geometry.constellationZoomAt(initial,point,-10000).scale,3.4);assert.equal(geometry.constellationZoomAt(initial,point,10000).scale,.72);
  assert.deepEqual(geometry.constellationPanFromClientDelta(initial,30,45,420),{...initial,x:initial.x+30/1.7,y:initial.y+45/1.7});
  assert.deepEqual(geometry.constellationZoomAt(initial,point,NaN),initial);
  const path=geometry.storyEdgePathD({kind:'travel',order:2},point,{x:30,y:45});assert.match(path,/^M .* Q /);assert.equal(path.includes('NaN'),false);
});


test('title-free shared resolver preserves exact canonical target geometry and score for every active entry, yaw and visit pattern',async()=>{
  const {resolveNavigationTarget}=await import('../src/lib/navigationResolver.ts');
  const {buildSpatialStoryNodes,entryWorldPosition}=await import('../src/lib/worldLayout.ts');
  for(const activeEntryId of ids)for(const cameraYaw of [-Math.PI,-1,0,1,Math.PI])for(const visitedEntryIds of [[],ids.slice(0,17),ids]){
    const nodes=buildSpatialStoryNodes({activeEntryId,entries,visitedEntryIds});
    const options={nodes,activeEntryId,visitedEntryIds,playerPosition:entryWorldPosition(entries.find(entry=>entry.id===activeEntryId),entries),cameraYaw};
    const expected=resolveNavigationTarget(options);
    const guarded=nodes.map(node=>({...node,entry:new Proxy(node.entry,{get(target,key){if(key==='title')throw Error('Unwitnessed route title was read');return Reflect.get(target,key);}})}));
    assert.deepEqual(resolveNavigationTarget({...options,nodes:guarded,includeTitle:false}),{...expected,title:''});
  }
});

test('pure full and partial presentation never consult unwitnessed title/body/paragraph getters including full fallback resolution',()=>{
  const memory=deriveConstellationMemory(state({witnessedEntryIds:[ids[0]]}));
  const guarded=entries.map(entry=>entry.id===ids[0]?entry:new Proxy(entry,{get(target,key){if(['title','body','paragraphs'].includes(key))throw Error('Unwitnessed prose read');return Reflect.get(target,key);}}));
  for(const scope of ['full','witnessed-only'])for(const sceneProximity of [null,{activeEntryId:ids[0],navigationTargetId:ids[20]}]){
    const result=frame(memory,{entries:guarded,scope,sceneProximity});
    assert.equal(result.nodeMap.size,1);assert.equal(result.anonymousPoints.length,65);
    assert.equal(result.listedEntries[0].title,entries[0].title);
  }
});
