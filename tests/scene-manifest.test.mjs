import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prep = await mkdtemp(join(tmpdir(), 'slipper-scene-manifest-cpu-'));
after(() => rm(prep, { recursive: true, force: true }));
const require = createRequire(join(repo, 'package.json'));
const ts = require('typescript'), { build } = require('esbuild');
await mkdir(join(prep, 'cpu'), { recursive: true });
const storyText = await readFile(join(repo, 'src/components/three/StoryScene.tsx'), 'utf8');
const story = ts.createSourceFile('StoryScene.tsx', storyText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const names = ['start', 'authoredArrival', 'playerSpawnX', 'playerSpawnZ', 'playerSpawnGroundY',
  'defaultPlayerInitialPosition', 'playerInitialPosition'];
const initializers = new Map();
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)
    && [...names, 'DEFAULT_CAMERA_POSITION'].includes(node.name.text)) initializers.set(node.name.text, node.initializer.getText(story));
  ts.forEachChild(node, visit);
}
visit(story);
assert.deepEqual(names.filter(name => !initializers.has(name)), [], 'Extract every actual StoryScene spawn/saved-pose initializer');
const statements = names.map(name => `const ${name} = ${initializers.get(name)};`).join('\n');
const originalStatements = await readFile(join(repo, 'tests/fixtures/scene-spawn-before-manifest.ts.txt'), 'utf8');
const candidateStatements = statements;
assert.ok(initializers.get('authoredArrival').includes('resolveSceneManifestArrival('), 'Execute the actual manifest arrival consumer');
const imported = relative => JSON.stringify(join(repo, 'src', relative));
const harness = `
import { SCENE_MANIFESTS, getSceneManifest, getSceneManifestForEntry, resolveSceneManifestArrival } from ${imported('narrative/StoryManifest.ts')};
import { journeyScenes, journeyChapters, getJourneySceneForEntry } from ${imported('data/journeyNarrative.ts')};
import { getJourneySceneLayout, getJourneyEntryWorldPosition, resolveJourneyRenderWindow } from ${imported('data/journeyWorldLayout.ts')};
import { getAuthoredSceneArrival } from ${imported('cinematics/sceneArrival.ts')};
import generatedWorldState from ${imported('data/worldState.json')} with { type: 'json' };
import { normalizeGeneratedWorldState } from ${imported('data/worldStateNormalization.ts')};
import { SCENE_LOOKS, resolveSceneLook } from ${imported('components/three/artDirection/SceneLookRegistry.ts')};
import { EMOTIONAL_PROFILES, resolveCinematicProfile } from ${imported('cinematics/emotionalProfiles.ts')};
import { resolveNarrativeAudioProfile, resolveNarrativeStemTarget, NARRATIVE_AUDIO_STEM_IDS } from ${imported('components/three/audio/narrativeAudioProfiles.ts')};
import { eventsForScene, objectsForScene, STORY_EVENTS } from ${imported('storyEvents/storyEventRegistry.ts')};
import { PLAYER_FOOT_OFFSET, PLAYER_GROUND_CLEARANCE } from ${imported('player/playerMovement.ts')};
import { PLAYER_CAMERA_OFFSET_Y } from ${imported('player/cameraModel.ts')};
import { DEFAULT_ENVIRONMENT_RADIUS, TERRAIN_BASE_Y } from ${imported('world/terrain/worldConstants.ts')};
import { entryWorldPosition } from ${imported('world/terrain/worldPlacement.ts')};
import { buildMazePathSegments } from ${imported('world/terrain/worldPaths.ts')};
import { terrainElevationAtPoint } from ${imported('world/terrain/terrainSampler.ts')};
const DEFAULT_CAMERA_POSITION = ${initializers.get('DEFAULT_CAMERA_POSITION')};
const useMemo = callback => callback();
const entries = normalizeGeneratedWorldState(generatedWorldState).entries;
const segments = buildMazePathSegments(entries);
const morph = { memoryPressure: .17, explorationDepth: .31 };
const sampleGroundY = (x, z) => TERRAIN_BASE_Y + terrainElevationAtPoint(x, z, entries, segments, morph);
function parameters(entry, mode, controls, initialPlayerPosition) {
  const narrativeScene = getJourneySceneForEntry(entry.id), activePosition = entryWorldPosition(entry, entries);
  const anchor = getJourneyEntryWorldPosition(narrativeScene.keystoneEntryId);
  const authoredSceneOrigin = [anchor[0], sampleGroundY(anchor[0], anchor[2]) + .2, anchor[2]];
  return { entry, mode, controls, initialPlayerPosition, narrativeScene, activePosition, authoredSceneOrigin };
}
function original({ entry, mode, controls, initialPlayerPosition, narrativeScene, activePosition, authoredSceneOrigin }) {
  ${originalStatements}
  return { start, authoredArrival, playerSpawnX, playerSpawnZ, defaultPlayerInitialPosition, playerInitialPosition };
}
function candidate({ entry, mode, controls, initialPlayerPosition, narrativeScene, activePosition, authoredSceneOrigin }) {
  const sceneManifest = getSceneManifestForEntry(entry.id);
  ${candidateStatements}
  return { start, authoredArrival, playerSpawnX, playerSpawnZ, defaultPlayerInitialPosition, playerInitialPosition };
}
export { SCENE_MANIFESTS, getSceneManifest, getSceneManifestForEntry, resolveSceneManifestArrival,
  journeyScenes, journeyChapters, getJourneySceneForEntry, getJourneySceneLayout, getAuthoredSceneArrival,
  resolveJourneyRenderWindow, entries, SCENE_LOOKS, resolveSceneLook, EMOTIONAL_PROFILES, resolveCinematicProfile,
  resolveNarrativeAudioProfile, resolveNarrativeStemTarget, NARRATIVE_AUDIO_STEM_IDS,
  eventsForScene, objectsForScene, STORY_EVENTS, original, candidate, parameters, sampleGroundY,
  PLAYER_FOOT_OFFSET, PLAYER_GROUND_CLEARANCE, PLAYER_CAMERA_OFFSET_Y };
`;
const entryPath = join(prep, 'cpu/harness.ts'), modulePath = join(prep, 'cpu/harness.mjs');
await writeFile(entryPath, harness);
await build({ entryPoints: [entryPath], outfile: modulePath, bundle: true, platform: 'node', format: 'esm', target: 'node22' });
const api = await import(pathToFileURL(modulePath).href);
const fallbackIds = ['broken-floor.confession', 'wolf-swan.false-choice', 'wolf-swan.convergence', 'climbs.arrival',
  'climb.mind', 'climb.heart', 'climb.womb', 'crowned.threshold', 'crowned.home', 'epilogue.constellation'];

test('all 32 manifests derive exact scene/chapter/environment/entry metadata and retain actual layout identity', () => {
  assert.equal(api.SCENE_MANIFESTS.length, 32);
  assert.equal(api.journeyChapters.length, 12);
  assert.deepEqual(api.SCENE_MANIFESTS.map(manifest => manifest.sceneId), api.journeyScenes.map(scene => scene.id));
  assert.equal(new Set(api.SCENE_MANIFESTS.map(manifest => manifest.chapterId)).size, 12);
  for (const scene of api.journeyScenes) {
    const manifest = api.getSceneManifest(scene.id);
    assert.equal(manifest.chapterId, scene.chapterId);
    assert.equal(manifest.environmentId, scene.environmentCue);
    assert.equal(manifest.keystoneEntryId, scene.keystoneEntryId);
    assert.deepEqual(manifest.echoEntryIds, scene.echoEntryIds);
    assert.equal(manifest.layout, api.getJourneySceneLayout(scene.id));
    assert.ok(Object.isFrozen(manifest) && Object.isFrozen(manifest.spawn) && Object.isFrozen(manifest.profiles));
    for (const entryId of scene.entryIds) assert.equal(api.getSceneManifestForEntry(entryId), manifest);
  }
  assert.equal(api.getSceneManifestForEntry('unknown-fragment'), undefined);
  assert.throws(() => api.getSceneManifest('unknown-scene'), RangeError);
});

test('22 authored arrivals and 10 active-fragment fallbacks retain rotated compositions and existing headings', () => {
  assert.deepEqual(api.SCENE_MANIFESTS.filter(manifest => manifest.spawn.source === 'active-fragment-camera-offset')
    .map(manifest => manifest.sceneId), fallbackIds);
  assert.equal(api.SCENE_MANIFESTS.filter(manifest => manifest.spawn.source === 'authored-arrival').length, 22);
  for (const manifest of api.SCENE_MANIFESTS) for (const heading of [0, .137, -1.4, Math.PI, manifest.layout.anchor.headingRadians]) {
    for (const origin of [[0, 0, 0], [-71.2, 3.6, 215.4], manifest.layout.anchor.position]) {
      assert.deepEqual(api.resolveSceneManifestArrival(manifest, origin, heading),
        api.getAuthoredSceneArrival(manifest.sceneId, origin, heading), `${manifest.sceneId} ${heading}`);
    }
  }
});

test('actual StoryScene initializers preserve active-fragment offsets, grounding and saved-pose rejection for all entries', () => {
  let echoCases = 0, acceptedSaved = 0;
  for (const entry of api.entries) {
    const manifest = api.getSceneManifestForEntry(entry.id);
    if (!manifest) continue;
    if (manifest.echoEntryIds.includes(entry.id)) echoCases++;
    for (const [mode, controls] of [['explore', 'walk'], ['explore', 'none'], ['map', 'orbit'], ['read', 'walk']]) {
      const parameters = api.parameters(entry, mode, controls, null), original = api.original(parameters);
      assert.deepEqual(api.candidate(parameters), original, `${entry.id} ${mode}/${controls}`);
      if (manifest.spawn.source === 'active-fragment-camera-offset' || mode !== 'explore' || controls !== 'walk') {
        assert.equal(original.playerSpawnX, parameters.activePosition[0] + original.start[0]);
        assert.equal(original.playerSpawnZ, parameters.activePosition[2] + original.start[2]);
      }
      const x = parameters.activePosition[0] + .3, z = parameters.activePosition[2] - .7;
      const cameraY = api.sampleGroundY(x, z) + api.PLAYER_FOOT_OFFSET + api.PLAYER_GROUND_CLEARANCE + api.PLAYER_CAMERA_OFFSET_Y;
      for (const saved of [[x, cameraY, z], [x, cameraY + 12.01, z], [10001, cameraY, z], [x + 1000, cameraY, z], [NaN, cameraY, z], [x, z]]) {
        const savedParameters = { ...parameters, initialPlayerPosition: saved };
        const former = api.original(savedParameters), after = api.candidate(savedParameters);
        assert.deepEqual(after, former, `${entry.id} saved pose`);
        if (saved.length === 3 && saved[0] === x && saved[1] === cameraY) {
          assert.deepEqual(after.playerInitialPosition, [x, api.sampleGroundY(x, z) + api.PLAYER_FOOT_OFFSET + api.PLAYER_GROUND_CLEARANCE, z]);
          acceptedSaved++;
        } else assert.deepEqual(after.playerInitialPosition, after.defaultPlayerInitialPosition);
      }
    }
  }
  assert.ok(echoCases > 0 && acceptedSaved > 0, 'Exercise echo entries and accepted saved poses');
});

test('event/object/target bindings are exact existing IDs and carry no outcomes, requirements or copied prose', () => {
  for (const manifest of api.SCENE_MANIFESTS) {
    const events = api.eventsForScene(manifest.sceneId), objects = api.objectsForScene(manifest.sceneId);
    assert.deepEqual(manifest.eventIds, events.map(event => event.id));
    assert.deepEqual(manifest.objectIds, objects.map(object => object.id));
    assert.deepEqual(manifest.interactionTargetIds, Array.from(new Set([
      ...events.flatMap(event => event.targetId ? [event.targetId] : []),
      ...objects.flatMap(object => (object.targets ?? []).map(target => target.id)),
    ])));
    for (const binding of manifest.interactionBindings) {
      const event = events.find(candidate => candidate.id === binding.eventId);
      assert.ok(event);
      assert.equal(binding.trigger, event.trigger);
      assert.equal(binding.objectId, event.objectId);
      assert.equal(binding.targetId, event.targetId);
      assert.deepEqual(Object.keys(binding).sort(), ['eventId', 'trigger', ...(event.objectId ? ['objectId'] : []), ...(event.targetId ? ['targetId'] : [])].sort());
    }
    assert.ok(!['title', 'prose', 'outcomes', 'requires', 'effects', 'completion'].some(key => key in manifest));
  }
});

test('profile IDs select actual look/camera/audio owners without freezing dynamic stillness or Surrender', () => {
  const states = [{}, { lanternOwned: true, surrenderComplete: true, compression: .5, mindReleased: true,
    creationComplete: true, nestHandsOccupied: 2, nestBurdenResting: true, mirrorStill: true, openingReveal: 1, openingInverted: true }];
  for (const manifest of api.SCENE_MANIFESTS) {
    const scene = api.journeyScenes.find(scene => scene.id === manifest.sceneId);
    assert.equal(manifest.profiles.audio, scene.audioCue);
    assert.ok(api.SCENE_LOOKS[manifest.profiles.look] && api.EMOTIONAL_PROFILES[manifest.profiles.camera]);
    for (const state of states) {
      assert.deepEqual(api.resolveCinematicProfile(manifest.profiles.camera, state), api.resolveCinematicProfile(scene.id, state));
      for (const quality of ['low', 'medium', 'high', 'cinematic']) for (const reduced of [false, true]) {
        assert.deepEqual(api.resolveSceneLook(manifest.profiles.look, quality, reduced, state), api.resolveSceneLook(scene.id, quality, reduced, state));
      }
      const audioState = { chapterId: manifest.chapterId, sceneId: manifest.sceneId, resonances: { wolf: 43, swan: 71, seer: 22 },
        releasedWords: ['private-example'], surrenderComplete: Boolean(state.surrenderComplete) };
      const audio = api.resolveNarrativeAudioProfile(audioState);
      assert.equal(audio.cue, manifest.profiles.audio);
    }
  }
  const mirror = api.getSceneManifest('sunset.stillness'), surrender = api.getSceneManifest('river.release-surrender');
  assert.equal(api.resolveSceneLook(mirror.profiles.look, 'high', false, {}).stillness, false);
  assert.equal(api.resolveSceneLook(mirror.profiles.look, 'high', false, { mirrorStill: true }).stillness, true);
  assert.equal(api.resolveSceneLook(surrender.profiles.look, 'high', false, { surrenderComplete: true }).stillness, true);
  const look = api.resolveSceneLook(surrender.profiles.look, 'high', false, {});
  const profile = api.resolveNarrativeAudioProfile({ chapterId: surrender.chapterId, sceneId: surrender.sceneId,
    resonances: { wolf: 0, swan: 0, seer: 0 }, releasedWords: [], surrenderComplete: false });
  for (const stem of api.NARRATIVE_AUDIO_STEM_IDS) assert.equal(api.resolveNarrativeStemTarget({}, stem, profile, look, 1,
    api.resolveCinematicProfile(surrender.profiles.camera, { surrenderComplete: true })).volume, 0);
});

test('JourneySceneDirector layout/render-window selection preserves the exact active and adjacent scene topology', () => {
  for (const manifest of api.SCENE_MANIFESTS) {
    const window = api.resolveJourneyRenderWindow(manifest.sceneId);
    assert.equal(window.activeSceneIds.length, 1);
    for (const entry of window.entries) {
      const selected = api.getSceneManifest(entry.sceneId);
      assert.equal(selected.layout, api.getJourneySceneLayout(entry.sceneId));
      assert.equal(selected.chapterId, selected.layout.chapterId);
      assert.equal(selected.profiles.look, entry.sceneId);
    }
  }
});
