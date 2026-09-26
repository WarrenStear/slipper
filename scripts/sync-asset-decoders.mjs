#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));
export const DECODER_FILES = Object.freeze([
  ['draco/gltf/draco_decoder.js', 'draco/draco_decoder.js'],
  ['draco/gltf/draco_wasm_wrapper.js', 'draco/draco_wasm_wrapper.js'],
  ['draco/gltf/draco_decoder.wasm', 'draco/draco_decoder.wasm'],
  ['basis/basis_transcoder.js', 'basis/basis_transcoder.js'],
  ['basis/basis_transcoder.wasm', 'basis/basis_transcoder.wasm'],
]);

/** Vendor the exact locked Three distribution, never a CDN's changing runtime. */
export function syncAssetDecoders({ root = repositoryRoot, write = false } = {}) {
  const threeRoot = resolve(root, 'node_modules/three');
  const { version } = JSON.parse(readFileSync(resolve(threeRoot, 'package.json'), 'utf8'));
  const files = DECODER_FILES.map(([source, target]) => {
    const sourcePath = resolve(threeRoot, 'examples/jsm/libs', source);
    const targetPath = resolve(root, 'public', target);
    const original = readFileSync(sourcePath);
    if (write) { mkdirSync(dirname(targetPath), { recursive: true }); copyFileSync(sourcePath, targetPath); }
    if (!existsSync(targetPath) || !original.equals(readFileSync(targetPath))) {
      throw new Error(`Decoder ${target} differs from Three ${version}; run npm run assets:sync-decoders and review the vendor update.`);
    }
    if (target.endsWith('.wasm') && !original.subarray(0, 8).equals(Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))) {
      throw new Error(`Invalid WebAssembly decoder: ${target}`);
    }
    return { source: `three/examples/jsm/libs/${source}`, runtimeUrl: `/${target}`, bytes: original.length, sha256: createHash('sha256').update(original).digest('hex') };
  });
  for (const family of ['draco', 'basis']) {
    const licence = readFileSync(resolve(root, 'public', family, 'LICENSE'), 'utf8');
    if (!licence.includes('Apache License') || !licence.includes('Version 2.0')) throw new Error(`Missing ${family} Apache-2.0 licence`);
  }
  const manifest = { schemaVersion: 1, threeVersion: version, licence: 'Apache-2.0', files };
  const manifestPath = resolve(root, 'docs/asset-decoder-manifest.json');
  const encoded = JSON.stringify(manifest, null, 2) + '\n';
  if (write) writeFileSync(manifestPath, encoded);
  else if (readFileSync(manifestPath, 'utf8') !== encoded) throw new Error('Decoder manifest is stale; review npm run assets:sync-decoders output.');
  return manifest;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--write' && arg !== '--check') || args.length > 1) throw new Error('Usage: node scripts/sync-asset-decoders.mjs [--check|--write]');
    const manifest = syncAssetDecoders({ write: args.includes('--write') });
    console.log(`[asset-decoders] ${manifest.files.length} local runtime files verified against Three ${manifest.threeVersion} (${manifest.files.reduce((bytes, file) => bytes + file.bytes, 0)} bytes).`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
