import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { productionAssetManifest } from '../scripts/validate-production-assets.mjs';
import { syncAssetDecoders } from '../scripts/sync-asset-decoders.mjs';

const hero = { status: 'reviewed-production', url: '/art/heroes/diagnostic.glb', contract: 'Test-only geometry, never art approval', review: {
  provenance: 'Automated diagnostic', licence: 'Test', reviewedBy: 'Test fixture', reviewedAt: '2026-09-26T00:00:00.000Z', revision: 'test', maxTriangles: 12, maxMaterials: 1, maxTextures: 0, maxTextureDimension: 1024, bounds: { min: [-1, 0, -1], max: [1, 2, 1] },
} };
const maps = { status: 'reviewed-production', maxDimension: 1024, repeat: [1, 1], channels: { map: '/art/materials/diagnostic.ktx2' }, provenance: 'Decoder diagnostic only', licence: 'MIT', reviewedBy: 'Test fixture', reviewedAt: '2026-09-26' };
function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'sitw-asset-admission-'));
  mkdirSync(join(root, 'public/art/heroes'), { recursive: true }); mkdirSync(join(root, 'public/art/materials'), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}
function glb(json) {
  const text = Buffer.from(JSON.stringify(json)); const padded = Math.ceil(text.length / 4) * 4; const data = Buffer.alloc(20 + padded, 0x20);
  data.writeUInt32LE(0x46546c67, 0); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8); data.writeUInt32LE(padded, 12); data.writeUInt32LE(0x4e4f534a, 16); text.copy(data, 20); return data;
}
test('shipping manifest derives every gated slot without admitting legacy models', () => {
  const report = productionAssetManifest();
  assert.equal(report.assets.length, 34); assert.equal(report.approvedProductionAssets, 0);
  assert.deepEqual(report.assets.reduce((counts, asset) => ({ ...counts, [asset.kind]: (counts[asset.kind] ?? 0) + 1 }), {}), { hero: 13, material: 11, audio: 10 });
  assert.ok(report.assets.every(asset => asset.runtimeUrls.length === 0 && asset.fallback && asset.validationDate));
});
test('published decoder bytes and manifest match the locked Three distribution', () => {
  const result = syncAssetDecoders(); assert.equal(result.files.length, 5);
  assert.ok(result.files.every(file => file.bytes > 0 && /^[a-f0-9]{64}$/.test(file.sha256)));
});
test('asset preflight rejects missing reviewed files and unsafe registry URLs', t => {
  const root = fixture(t), base = { root, materials: {}, audio: {} };
  assert.throws(() => productionAssetManifest({ ...base, heroes: { key: hero } }), /does not exist/);
  assert.throws(() => productionAssetManifest({ ...base, heroes: { key: { ...hero, url: '/art/heroes/../../private.glb' } } }), /Invalid reviewed hero/);
  assert.throws(() => productionAssetManifest({ ...base, heroes: { key: { ...hero, url: 'https://example.com/diagnostic.glb' } } }), /Invalid reviewed hero/);
});
test('reviewed GLB preflight rejects placeholders and external dependencies before parse', t => {
  const root = fixture(t), options = { root, heroes: { key: hero }, materials: {}, audio: {} }, file = join(root, 'public/art/heroes/diagnostic.glb');
  writeFileSync(file, glb({ asset: { version: '2.0' }, extras: { sidtwPlaceholder: true } }));
  assert.throws(() => productionAssetManifest(options), /placeholder/);
  writeFileSync(file, glb({ asset: { version: '2.0' }, buffers: [{ uri: 'https://example.com/geometry.bin' }] }));
  assert.throws(() => productionAssetManifest(options), /embed buffers/);
});
test('reviewed asset symlinks cannot expose files outside public', t => {
  const root = fixture(t), outside = join(root, 'not-public.glb');
  writeFileSync(outside, glb({ asset: { version: '2.0' } })); symlinkSync(outside, join(root, 'public/art/heroes/diagnostic.glb'));
  assert.throws(() => productionAssetManifest({ root, heroes: { key: hero }, materials: {}, audio: {} }), /escapes public/);
});
test('material manifest checks real KTX2 containers and 1024 dimension budget', t => {
  const root = fixture(t), file = join(root, 'public/art/materials/diagnostic.ktx2'), options = { root, heroes: {}, materials: { wood: maps }, audio: {} };
  writeFileSync(file, 'invalid'); assert.throws(() => productionAssetManifest(options), /Invalid material KTX2/);
  const data = readFileSync(new URL('./fixtures/production-delivery/diagnostic-etc1s.ktx2', import.meta.url));
  writeFileSync(file, data); const report = productionAssetManifest(options); assert.equal(report.assets[0].files[0].bytes, data.length);
  const oversized = Buffer.from(data); oversized.writeUInt32LE(2048, 20); writeFileSync(file, oversized);
  assert.throws(() => productionAssetManifest(options), /bounded 2D/);
  for (const levels of [0, 32]) {
    const invalid = Buffer.from(data); invalid.writeUInt32LE(levels, 40); writeFileSync(file, invalid);
    assert.throws(() => productionAssetManifest(options), /bounded 2D/);
  }
});
test('stable art/audio/decoder URLs revalidate while version metadata remains uncached', () => {
  const headers = readFileSync(new URL('../public/_headers', import.meta.url), 'utf8');
  for (const path of ['/art/*', '/audio/*', '/draco/*', '/basis/*']) {
    assert.ok(headers.includes(`${path}\n  Cache-Control: public, max-age=0, must-revalidate`));
  }
  assert.ok(headers.includes('/version.json\n  Cache-Control: no-store'));
});
