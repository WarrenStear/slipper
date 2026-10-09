import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import ts from 'typescript';
const read=relative=>readFileSync(new URL(relative,import.meta.url),'utf8');
const parse=source=>ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
function collect(source,predicate){const tree=parse(source),matches=[];function walk(node){if(predicate(node,tree))matches.push(node.getText(tree));ts.forEachChild(node,walk);}walk(tree);return matches;}
function before(name){const source=read('./fixtures/photo-memory/'+name+'.txt'),manifest=JSON.parse(read('./fixtures/photo-memory/boundary-manifest.json'));assert.equal(createHash('sha256').update(source).digest('hex'),manifest[name]);return source;}
test('actual composed FragmentReader preserves admitted paragraphs, scroll, focus and footer commands with anonymous trace inside its boundary',()=>{
 const source=read('../src/ui/reader/FragmentReader.tsx'),baseline=before('FragmentReader.tsx'),app=read('../src/App.tsx');
 const effect=node=>ts.isCallExpression(node)&&node.expression.getText()==='useEffect';
 assert.deepEqual(collect(source,effect),collect(baseline,effect));
 for(const name of ['paragraphs','updateProgress']){const declaration=node=>ts.isVariableDeclaration(node)&&node.name.getText()===name;assert.deepEqual(collect(source,declaration),collect(baseline,declaration));}
 const footer=node=>ts.isJsxElement(node)&&node.openingElement.attributes.getText().includes('className="reader-footer"');
 assert.deepEqual(collect(source,footer),collect(baseline,footer));
 assert.ok(source.indexOf('if (!admitted || !entry) return null;')<source.indexOf('<FragmentTrace entryId={entryId}'));
 assert.ok(source.includes('data-fragment-surface="true"'));
 assert.ok(app.includes('{mode === "read" && canReadActiveEntry ? <FragmentReader'));
 assert.ok(app.includes('() => canReadStoryEntry(resolvedActiveEntryId, { witnessedEntryIds })\n      ? visuals.find'));
 assert.equal(/new Image\(|useTexture\(|\/visuals\//.test(source+app),false);
});
test('actual world removes eager visual derivation and preserves current physical observations and chapter composition',()=>{
 const source=read('../src/components/three/StoryScene.tsx'),baseline=before('StoryScene.tsx');
 for(const name of ['handleObservedThreshold','handleObservedClearing']){
  const predicate=node=>ts.isVariableDeclaration(node)&&node.name.getText()===name;const current=collect(source,predicate);assert.equal(current.length,1);assert.deepEqual(current,collect(baseline,predicate),name);
 }
 const chapter=node=>ts.isFunctionDeclaration(node)&&node.name?.text==='ChapterShrine';assert.deepEqual(collect(source,chapter),collect(baseline,chapter));
 assert.equal(/const visualByEntryId|function MemoryShrine\(|useTexture/.test(source),false);
 assert.ok(source.includes('visual={node.isActive && !getJourneySceneForEntry(node.entry.id) && witnessedEntryIds.includes(node.entry.id)'));
 assert.ok(source.includes('import { MemoryShrine } from "../../photos/PhotoMemory"'));
 assert.ok(source.includes('audioEnabled && !narrativeAudioSuppressed && mode === "explore"'));
 assert.ok(source.includes('navigationTargetNode ? createAudioApproachTarget('));
});
test('photo and trace owners cannot issue outcomes, run frame directors or request a photo before the admitted child',()=>{
 const source=read('../src/photos/PhotoMemory.tsx'),admission=read('../src/photos/photoMemoryAdmission.ts');
 assert.equal(/useFrame|Html|dispatchStoryEvent|completeScene|completeStory|witnessEntry\(|\.dispatch\(|new AudioContext|setInterval|setTimeout/.test(source),false);
 assert.ok(source.includes('return memory ? <FramedPhotoMemory'));assert.ok(source.includes('photoMemoryTexturePool(gl).acquire(memory.src)'));
 assert.ok(source.includes('if(!disposed)setLoaded(resource)'));assert.ok(source.includes('owned.release()'));
 assert.ok(source.includes('resources.frame.dispose();resources.plane.dispose();resources.frameMaterial.dispose();resources.photoMaterial.dispose()'));
 assert.ok(admission.indexOf('gate.witnessedEntryIds.includes')<admission.indexOf('entries.find'));
 assert.ok(admission.indexOf('explicitId !== entry.engine3d.linkedVisualId')<admission.indexOf('visuals.find'));
 const trace=read('../src/ui/reader/fragmentTracePresentation.ts');assert.equal(/Slipper3DVisual|visuals|\.body|\.paragraphs|fetch\(|dispatch|setTimeout|setInterval/.test(trace),false);
});
