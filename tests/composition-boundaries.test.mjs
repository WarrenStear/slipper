import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function nodes(source,predicate){const tree=ts.createSourceFile('owner.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),found=[];function visit(node){if(predicate(node,tree))found.push(node);ts.forEachChild(node,visit);}visit(tree);return {tree,found};}

test('UI owners have no runtime/store mutation or renderer frame scheduler; reader has only its cancellable DOM focus timer',()=>{
 for(const file of ['src/ui/reader/FragmentReader.tsx','src/ui/map/MapWorkspace.tsx','src/ui/navigation/RememberedPaths.tsx']){
  const source=read(file),{tree,found}=nodes(source,node=>ts.isCallExpression(node));
  const names=found.map(node=>node.expression.getText(tree));
  assert.equal(names.some(name=>/useFrame|requestAnimationFrame|\.dispatch|\.setState|\.getState|startStory|witnessEntry|completeRitual|completeScene|completeChapter|navigateToEntry|setSafePosition/.test(name)),false,file);
  assert.equal(names.filter(name=>name==='window.setTimeout').length,file.includes('FragmentReader')?1:0,file);
  if(file.includes('FragmentReader'))assert.ok(names.includes('window.clearTimeout'));
  const imports=nodes(source,node=>ts.isImportDeclaration(node)&&!node.importClause?.isTypeOnly).found;
  assert.equal(imports.some(node=>/StoryRuntimeContext|useJourneyStore|useWorldStore|useSettingsStore/.test(node.moduleSpecifier.text)),false,file);
 }
});

test('App keeps one host/nav composition and the explicit focus nonce, pane, setting and accepted navigation handoffs',()=>{
 const source=read('src/App.tsx'),{tree,found}=nodes(source,node=>ts.isCallExpression(node));
 for(const owner of ['useStoryRuntimeShell','useStoryNavigation'])assert.equal(found.filter(node=>node.expression.getText(tree)===owner).length,1,owner);
 const attributes=nodes(source,node=>ts.isJsxAttribute(node)).found;
 const port=name=>attributes.filter(node=>node.name.getText(tree)===name).map(node=>node.getText(tree));
 assert.ok(port('focusNonce').includes('focusNonce={readerFocusNonce}'));
 assert.ok(port('workspaceRef').includes('workspaceRef={mapWorkspaceRef}'));
 assert.ok(port('activePane').includes('activePane={mobileMapPane}'));
 assert.ok(port('onSettingChange').includes('onSettingChange={setSetting}'));
 assert.ok(port('onOpenEntry').some(value=>value.includes('navigateToEntry(entryId, "explore")')));
 assert.ok(port('onOpenEntry').some(value=>value.includes('openRememberedEntry(entryId, "read")')));
 assert.ok(port('onFollow').some(value=>value.includes('requestGuidance(authoredJourneyTarget?.id)')));
 assert.ok(port('onBookmark').some(value=>value.includes('toggleBookmark(resolvedActiveEntryId)')));
});

test('only the map workspace declares the lazy constellation and the shell retains its prior safe mode focus handoff',()=>{
 const app=read('src/App.tsx'),workspace=read('src/ui/map/MapWorkspace.tsx');
 const isLazy=node=>ts.isCallExpression(node)&&node.expression.getText()==='lazy';
 assert.equal(nodes(app,isLazy).found.length,1,'Only the WorldCanvas lazy boundary remains in App');
 assert.equal(nodes(workspace,isLazy).found.length,1,'Constellation lazy loading belongs to its actual workspace');
 const {tree,found}=nodes(app,node=>ts.isVariableDeclaration(node)&&node.name.getText()==='previousViewRef');assert.equal(found.length,1);assert.equal(found[0].initializer.getText(tree),'useRef(mode)');
 assert.match(app,/const target = mode === "map" \? mapWorkspaceRef/);
 assert.match(app,/constellationTriggerRef.current \?\? forestRef.current/);
});
