#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync, writeFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { HERO_ASSETS, approvedHeroAsset } from '../src/components/three/actors/heroAssetRegistry.ts';
import { HERO_MAX_COMPRESSED_BYTES, validateHeroGlbBytes } from '../src/lib/assets/heroAssetValidation.ts';
import { MATERIAL_MAPS, approvedMaterialMaps } from '../src/components/three/materials/materialMapRegistry.ts';
import { MAX_MATERIAL_COMPRESSED_BYTES, validateMaterialKtx2Bytes } from '../src/components/three/materials/productionMaterialRuntime.ts';
import { PRODUCTION_AUDIO_REGISTRY, reviewedProductionAudio, MAX_PRODUCTION_AUDIO_BYTES } from '../src/components/three/audio/productionAudioRegistry.ts';
import { syncAssetDecoders } from './sync-asset-decoders.mjs';

const repositoryRoot = fileURLToPath(new URL('../', import.meta.url));

/** Registry-derived inventory. No filenames, directories or metadata imply approval. */
export function productionAssetManifest({ root = repositoryRoot, heroes = HERO_ASSETS, materials = MATERIAL_MAPS, audio = PRODUCTION_AUDIO_REGISTRY, validatedAt = new Date().toISOString() } = {}) {
  const publicRoot = realpathSync(resolve(root, 'public'));
  const inventory = [];
  function assetFile(url, maxBytes) {
    const file = resolve(publicRoot, '.' + url);
    if (!existsSync(file) || !statSync(file).isFile()) throw new Error(`Reviewed asset does not exist: ${url}`);
    if (!realpathSync(file).startsWith(publicRoot + sep)) throw new Error(`Reviewed asset escapes public directory: ${url}`);
    const size = statSync(file).size;
    if (size < 1 || size > maxBytes) throw new Error(`Reviewed asset exceeds byte budget: ${url}`);
    const data = readFileSync(file);
    return { data, evidence: { runtimeUrl: url, bytes: size, sha256: createHash('sha256').update(data).digest('hex') } };
  }
  function record(kind, id, entry, source, fallback, files, review) {
    inventory.push({ kind, asset: id, status: entry.status, source, reviewState: entry.status === 'reviewed-production' ? 'review metadata and file preflight valid; artistic/device review remains required' : entry.status === 'reviewed-generated' ? 'generated approximation; review metadata and file preflight valid; device review remains required' : 'no runtime asset admitted', runtimeUrls: files.map(file => file.runtimeUrl), fallback, review: review ?? null, validationDate: validatedAt, files });
  }
  for (const [id, entry] of Object.entries(heroes)) {
    let files = [];
    if (entry.status === 'reviewed-production') {
      const approved = approvedHeroAsset(entry);
      if (!approved) throw new Error(`Invalid reviewed hero registry entry: ${id}`);
      const file = assetFile(approved.url, HERO_MAX_COMPRESSED_BYTES);
      validateHeroGlbBytes(file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength), approved.review);
      files = [file.evidence];
    } else if (entry.status !== 'authored-fallback' || entry.url !== null) throw new Error(`Invalid fallback hero registry entry: ${id}`);
    record('hero', id, entry, entry.review?.provenance ?? 'Authored scene geometry', entry.contract, files, entry.review);
  }
  for (const [id, entry] of Object.entries(materials)) {
    const files = [];
    const reviewed = entry.status === 'reviewed-production' || entry.status === 'reviewed-generated';
    if (reviewed) {
      const approved = approvedMaterialMaps(entry);
      if (!approved) throw new Error(`Invalid reviewed material registry entry: ${id}`);
      for (const [channel, url] of Object.entries(approved.channels)) {
        const file = assetFile(url, MAX_MATERIAL_COMPRESSED_BYTES), data = file.data;
        validateMaterialKtx2Bytes(data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength));
        const width = data.readUInt32LE(20), height = data.readUInt32LE(24);
        if (!width || !height || width > approved.maxDimension || height > approved.maxDimension || data.readUInt32LE(28) > 0 || data.readUInt32LE(32) > 0 || data.readUInt32LE(36) !== 1) throw new Error(`Invalid 2D material dimensions: ${url}`);
        files.push({ ...file.evidence, channel, width, height });
      }
    } else if (entry.status !== 'procedural-fallback' || Object.keys(entry.channels).length) throw new Error(`Invalid fallback material registry entry: ${id}`);
    record('material', id, entry, entry.provenance ?? 'Procedural material-memory shader', 'TactileMaterial with scene wetness, wear, damage and reintegration', files, reviewed ? { provenance: entry.provenance, licence: entry.licence, reviewedBy: entry.reviewedBy, reviewedAt: entry.reviewedAt, revision: entry.revision ?? null } : null);
  }
  for (const [id, entry] of Object.entries(audio)) {
    const files = [];
    if (entry.status === 'reviewed-production') {
      const approved = reviewedProductionAudio(entry);
      if (!approved) throw new Error(`Invalid reviewed audio registry entry: ${id}`);
      for (const source of [approved, ...(approved.alternatives ?? [])]) {
        const file = assetFile(source.url, MAX_PRODUCTION_AUDIO_BYTES), data = file.data;
        const hasSignature = source.format === 'ogg' ? data.subarray(0, 4).toString() === 'OggS' : data.subarray(0, 3).toString() === 'ID3' || (data.length > 1 && data[0] === 0xff && (data[1] & 0xe0) === 0xe0);
        if (!hasSignature) throw new Error(`Invalid ${source.format} container: ${source.url}`);
        files.push({ ...file.evidence, format: source.format });
      }
    } else if (entry.status !== 'procedural-fallback' || entry.url !== null) throw new Error(`Invalid fallback audio registry entry: ${id}`);
    record('audio', id, entry, entry.provenance, `Deterministic procedural ${id} stem`, files, entry.status === 'reviewed-production' ? { reviewedBy: entry.reviewedBy, reviewedAt: entry.reviewedAt } : null);
  }
  return { schemaVersion: 1, validatedAt, authority: ['HERO_ASSETS', 'MATERIAL_MAPS', 'PRODUCTION_AUDIO_REGISTRY'], approvedProductionAssets: inventory.filter(asset => asset.status === 'reviewed-production').length, reviewedGeneratedAssets: inventory.filter(asset => asset.status === 'reviewed-generated').length, assets: inventory };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const args = process.argv.slice(2);
    if (args.length && !(args.length === 2 && args[0] === '--manifest')) throw new Error('Usage: validate-production-assets.mjs [--manifest output.json]');
    const decoders = syncAssetDecoders();
    const manifest = productionAssetManifest();
    if (args.length) writeFileSync(resolve(args[1]), JSON.stringify({ ...manifest, decoders }, null, 2) + '\n');
    console.log(`[production-assets] ${manifest.assets.length} registry slots, ${manifest.approvedProductionAssets} production assets and ${manifest.reviewedGeneratedAssets} generated approximations activated; ${decoders.files.length} local decoder files verified.`);
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
