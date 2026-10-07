import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { getStoryObject, eventsForScene } from '../src/storyEvents/storyEventRegistry.ts';
import { CINEMATIC_ACTOR_CUES } from '../src/cinematics/cinematicCueRegistry.ts';
import { RENDER_QUALITY_PROFILES } from '../src/components/three/renderQuality.ts';

const read = relative => readFileSync(new URL(`../${relative}`, import.meta.url), 'utf8');
const former = read('tests/fixtures/first-wood-before-extraction.txt');
const current = read('src/scenes/first-wood/FirstWoodScene.tsx');
const compile = source => ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const el = (type, props, key) => ({ type, props, key });
const marker = name => name;
const primitives = Object.fromEntries(['CandleField','FabricVeil','FloatingMotes','LanternProp','SceneGround','StonePath','WaterSurface'].map(name => [name, marker(name)]));
function renderScene(source, sceneId, eventDriven, quality, reducedEffects, reducedMotion, canonicalObjectLookup = getStoryObject) {
  const imports = {
    react: { memo: component => component },
    'react/jsx-runtime': { jsx: el, jsxs: el, Fragment: 'fragment' },
    '@react-three/rapier': { RigidBody: marker('RigidBody'), CuboidCollider: marker('CuboidCollider') },
  };
  for (const prefix of ['..', '../../components/three']) {
    imports[`${prefix}/environment/WoodlandHabitat`] = { RootThreshold: marker('RootThreshold') };
    imports[`${prefix}/artDirection/LegacyChapterLight`] = { LegacyChapterLight: marker('LegacyChapterLight') };
    imports[`${prefix}/environment/EnvironmentDressing`] = { ForestDepth: marker('ForestDepth') };
    imports[`${prefix}/environment/WoodlandDetails`] = { MeadowFlowers: marker('MeadowFlowers') };
    imports[`${prefix}/environment/ChapterLightRig`] = { ChapterLightRig: marker('ChapterLightRig') };
  }
  imports['./ChapterPrimitives'] = primitives;
  imports['../../components/three/chapters/ChapterPrimitives'] = primitives;
  const store = { useJourneyStore: select => select({ worldFlags: { 'story-events.started': eventDriven } }) };
  imports['../../../stores/useJourneyStore'] = store; imports['../../stores/useJourneyStore'] = store;
  imports['../../storyEvents/storyEventRegistry'] = { getStoryObject: canonicalObjectLookup };
  const exports = {};
  runInNewContext(compile(source), { exports, require: id => { assert.ok(id in imports, id); return imports[id]; } });
  const props = { scene: { id: sceneId }, qualityProfile: RENDER_QUALITY_PROFILES[quality], reducedEffects, reducedMotion };
  return { tree: exports.EnchantedWoodChapter(props), exports };
}
function elements(tree) {
  if (Array.isArray(tree)) return tree.flatMap(elements);
  if (!tree || typeof tree !== 'object' || !tree.props) return [];
  const children = Array.isArray(tree.props.children) ? tree.props.children : [tree.props.children];
  return [tree, ...children.flatMap(elements)];
}
const nodes = (tree, type) => elements(tree).filter(node => node.type === type);
const plain = value => JSON.parse(JSON.stringify(value));
const variants = () => ['low','medium','high','cinematic'].flatMap(quality => [false,true].flatMap(reducedEffects => [false,true].flatMap(reducedMotion => [false,true].map(eventDriven => ({ quality,reducedEffects,reducedMotion,eventDriven })))));

function withoutPathDiscs(value) {
  if(Array.isArray(value))return value.filter(item=>item!==null&&item!==false&&item?.type!=='StonePath').map(withoutPathDiscs);
  if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,withoutPathDiscs(item)]));
  return value;
}

test('FirstWood retains exact meadow/hearth presentation except removed competing path discs across every gate', () => {
  for (const sceneId of ['enchanted.friendship-meadow','enchanted.masked-hearth']) for (const v of variants()) {
    const before = renderScene(former,sceneId,v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion);
    const after = renderScene(current,sceneId,v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion);
    assert.equal(nodes(after.tree,'StonePath').length,0); assert.equal(nodes(before.tree,'StonePath').length,1);
    assert.deepEqual(withoutPathDiscs(plain(after.tree)), withoutPathDiscs(plain(before.tree)), `${sceneId} ${JSON.stringify(v)}`);
    assert.equal(after.exports.FirstWoodScene, after.exports.EnchantedWoodChapter);
    assert.equal(after.exports.default, after.exports.FirstWoodScene);
  }
});

test('Rabbit drops only competing path discs/motes and preserves exact ground/ecology/root threshold/collider and local lighting contracts', () => {
  for (const v of variants()) {
    const before = renderScene(former,'enchanted.rabbit-hole',v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion).tree;
    const after = renderScene(current,'enchanted.rabbit-hole',v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion).tree;
    assert.equal(nodes(before,'StonePath').length,1); assert.equal(nodes(before,'FloatingMotes').length,1);
    assert.equal(nodes(after,'StonePath').length,0); assert.equal(nodes(after,'FloatingMotes').length,0);
    for (const type of ['SceneGround','ForestDepth','RootThreshold','RigidBody','CuboidCollider','CandleField','FabricVeil','ChapterLightRig','LegacyChapterLight','hemisphereLight']) {
      assert.deepEqual(plain(nodes(after,type)),plain(nodes(before,type)), `${type} ${JSON.stringify(v)}`);
    }
    assert.deepEqual(plain(nodes(after,'CuboidCollider').map(node => node.props)), [
      { args:[.66,1.4,.66],position:[-2.9,1.2,2.55] }, { args:[.58,1.4,.58],position:[3,1.2,2.95] },
    ]);
    const lanterns = nodes(after,'LanternProp'); assert.equal(lanterns.length,1);
    assert.equal(lanterns[0].props.light,false); assert.equal(lanterns[0].props.scale,.78); assert.equal(lanterns[0].props.reducedMotion,v.reducedMotion);
    assert.equal(nodes(after,'pointLight').length,0); assert.equal(nodes(after,'spotLight').length,0);
  }
});

test('grounded guide image derives canonical horizontal coordinates without changing the actual semantic volume/event', () => {
  const guide = getStoryObject('enchanted.guide'), before = plain(guide);
  assert.deepEqual(before.localPosition,[0,1.3,5]); assert.equal(guide.radius,2.2);
  for (const eventDriven of [false,true]) {
    const tree = renderScene(current,'enchanted.rabbit-hole',eventDriven,'high',false,false).tree;
    const lantern = nodes(tree,'LanternProp')[0], container = elements(tree).find(node => node.props.name === 'first-wood-distant-guide');
    assert.deepEqual(plain(lantern.props.position),[guide.localPosition[0],.15,guide.localPosition[2]]);
    assert.equal(container.props.userData.storyObjectId,guide.id);
    assert.equal(elements(tree).some(node=>node.props.name===`story-object:${guide.id}`),false,'A visual image must not override StoryEventDirector numeric target lookup');
  }
  assert.throws(() => renderScene(current,'enchanted.rabbit-hole',true,'high',false,false,() => undefined), /canonical First Wood guide is missing/);
  assert.deepEqual(plain(getStoryObject('enchanted.guide')),before);
  const event = eventsForScene('enchanted.rabbit-hole').find(event=>event.id==='enchanted.follow-light');
  assert.equal(event.trigger,'volume-enter'); assert.equal(event.objectId,'enchanted.guide');
  assert.doesNotMatch(current,/dispatchStoryEvent|navigateToEntry|setWorldFlag|useFrame|requestAnimationFrame|\.getState\(|localStorage|registerAsset/);
});

test('historic chapter import resolves the one substantive scene owner and canonical director retains the existing chapter binding', () => {
  assert.equal(read('src/components/three/chapters/EnchantedWoodChapter.tsx').trim(), 'export { FirstWoodScene, EnchantedWoodChapter, default } from "../../../scenes/first-wood/FirstWoodScene";');
  const director = read('src/components/three/journey/JourneySceneDirector.tsx');
  assert.match(director,/import \{ EnchantedWoodChapter \} from "\.\.\/chapters\/EnchantedWoodChapter"/);
  assert.match(director,/"enchanted-wood": EnchantedWoodChapter/);
});

function renderActors(sceneId,lanternOwned=false,lanternPlaced=false) {
  const source=ts.createSourceFile('StoryActorDirector.tsx',read('src/components/three/storyEvents/StoryActorDirector.tsx'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const owner=source.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text==='StoryActorDirector');
  assert.ok(owner);
  const declaration=owner.getText(source);
  const exports={};
  runInNewContext(compile(`${declaration}\nexport {StoryActorDirector};`),{exports,ORIGIN:[0,0,0],NO_CUES:[],CINEMATIC_ACTOR_CUES,
    AuthoredActor:marker('AuthoredActor'),InstancedStoryFlock:marker('InstancedStoryFlock'),require:id=>{assert.equal(id,'react/jsx-runtime');return{jsx:el,jsxs:el};}});
  return exports.StoryActorDirector({sceneId,lanternOwned,lanternPlaced,qualityProfile:RENDER_QUALITY_PROFILES.high,reducedEffects:false,reducedMotion:false});
}

test('actual actor owner suppresses only Rabbit lantern duplicate while preserving every other scene cue and owned/placed carrying gates',()=>{
  assert.ok(CINEMATIC_ACTOR_CUES['enchanted.rabbit-hole'].some(cue=>cue.actor==='lantern'),'The registry cue remains unmodified');
  for(const[sceneId,cues]of Object.entries(CINEMATIC_ACTOR_CUES))for(const owned of [false,true])for(const placed of [false,true]){
    const actual=nodes(renderActors(sceneId,owned,placed),'AuthoredActor').map(node=>node.props.definition);
    const expected=cues.filter(cue=>!(sceneId.startsWith('sunset.')&&cue.actor==='seer')&&(cue.actor!=='lantern'||(sceneId!=='enchanted.rabbit-hole'&&!owned&&!placed)));
    assert.deepEqual(plain(actual),plain(expected),`${sceneId} owned=${owned} placed=${placed}`);
  }
});

test('all three current First Wood bodies remove only StonePath, preserving every collider, landmark and gate',()=>{
  const baseline=read('tests/fixtures/forest-art-foundation/FirstWoodScene.txt');
  assert.equal(createHash('sha256').update(baseline).digest('hex'),'2b56c633067bc177b2b024ef42e1170981ed4919deffb53c0686cec74f5a68dc');
  for(const id of ['enchanted.rabbit-hole','enchanted.friendship-meadow','enchanted.masked-hearth'])for(const v of variants()){
    const before=renderScene(baseline,id,v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion).tree;
    const after=renderScene(current,id,v.eventDriven,v.quality,v.reducedEffects,v.reducedMotion).tree;
    assert.deepEqual(withoutPathDiscs(plain(after)),withoutPathDiscs(plain(before)));
    assert.equal(nodes(after,'StonePath').length,0);
  }
});
