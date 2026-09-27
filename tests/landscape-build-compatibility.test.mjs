import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';
import { LANDSCAPE_SCENES, landscapeForScene } from '../src/components/three/environment/landscapeGeography.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const moduleUrl = new URL('../src/components/three/environment/landscapeGeography.ts', import.meta.url);

test('landscape and its imports typecheck against the actual application target and libraries', () => {
  const configPath = fileURLToPath(new URL('../tsconfig.json', import.meta.url));
  const loaded = ts.readConfigFile(configPath, ts.sys.readFile);
  assert.equal(loaded.error, undefined);
  // Check this dependency-free slice using production compiler options, not
  // an ESNext test default. Exclude third-party ambient types from the fixture.
  const parsed = ts.parseJsonConfigFileContent({
    ...loaded.config,
    files: [fileURLToPath(moduleUrl)],
    include: [],
    exclude: [],
  }, ts.sys, dirname(configPath));
  const program = ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, types: [], noEmit: true },
  });
  const diagnostics = [...parsed.errors, ...ts.getPreEmitDiagnostics(program)];
  const message = ts.formatDiagnostics(diagnostics, {
    getCanonicalFileName: name => name,
    getCurrentDirectory: () => root,
    getNewLine: () => '\n',
  });
  assert.equal(diagnostics.length, 0, message);
});

test('every registered scene still resolves to its authored landscape family', () => {
  assert.equal(Object.keys(LANDSCAPE_SCENES).length, 21);
  for (const [sceneId, family] of Object.entries(LANDSCAPE_SCENES)) {
    assert.equal(landscapeForScene(sceneId)?.family, family);
    assert.equal(landscapeForScene(sceneId), landscapeForScene(sceneId));
    assert.ok(Object.isFrozen(landscapeForScene(sceneId)));
  }
});

test('unknown scenes and inherited Object properties cannot select a landscape', () => {
  for (const sceneId of [
    '', 'enchanted.unknown', 'broken-floor.confession', 'blue-moon.sanctuary',
    '__proto__', 'constructor', 'prototype', 'toString', 'valueOf',
    'hasOwnProperty', 'isPrototypeOf', 'propertyIsEnumerable',
  ]) assert.equal(landscapeForScene(sceneId), null, sceneId);
});

test('scene lookup works without the ES2022 Object.hasOwn API', () => {
  // Use a child so removing the API cannot affect other tests or the test runner.
  const child = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '--eval', `
    import assert from 'node:assert/strict';
    Object.defineProperty(Object, 'hasOwn', { value: undefined, configurable: true });
    const { LANDSCAPE_SCENES, landscapeForScene } = await import(${JSON.stringify(moduleUrl.href)});
    for (const [sceneId, family] of Object.entries(LANDSCAPE_SCENES)) {
      assert.equal(landscapeForScene(sceneId)?.family, family);
    }
    for (const sceneId of ['__proto__', 'constructor', 'toString', 'hasOwnProperty', 'unknown']) {
      assert.equal(landscapeForScene(sceneId), null);
    }
  `], { cwd: root, encoding: 'utf8', timeout: 10000 });
  assert.equal(child.error, undefined);
  assert.equal(child.status, 0, child.stderr || child.stdout);
});
