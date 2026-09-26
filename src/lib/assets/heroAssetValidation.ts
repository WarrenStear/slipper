import * as THREE from "three";
import type { GLTF } from "three/examples/jsm/loaders/GLTFLoader.js";
import type { HeroAssetId, HeroAssetReview } from "../../components/three/actors/heroAssetRegistry.ts";
import { isPlaceholderNpcAsset } from "./npcAssetPolicy.ts";

export const HERO_MAX_COMPRESSED_BYTES = 16 * 1024 * 1024;
export const HERO_NETWORK_TIMEOUT_MS = 15_000;
const fail = (message: string): never => { throw new Error(`Hero asset rejected: ${message}`); };

/** Reject resource indirection before GLTFLoader can initiate additional requests. */
export function validateHeroGlbBytes(bytes: ArrayBuffer, review: HeroAssetReview) {
  if (bytes.byteLength < 20 || bytes.byteLength > HERO_MAX_COMPRESSED_BYTES) fail("invalid file size");
  const view = new DataView(bytes);
  if (view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== bytes.byteLength) fail("not a complete glTF 2 GLB");
  const jsonLength = view.getUint32(12, true);
  if (view.getUint32(16, true) !== 0x4e4f534a || jsonLength % 4 || jsonLength > bytes.byteLength - 20) fail("invalid JSON chunk");
  let offset = 12;
  while (offset < bytes.byteLength) {
    if (offset + 8 > bytes.byteLength) fail("truncated chunk");
    const length = view.getUint32(offset, true);
    if (length % 4 || length > bytes.byteLength - offset - 8) fail("invalid chunk length");
    offset += 8 + length;
  }
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(bytes, 20, jsonLength)));
  if (!json || typeof json !== "object" || json.asset?.version !== "2.0") fail("invalid asset version");
  const list = (value: unknown): Record<string, unknown>[] => value === undefined ? [] : Array.isArray(value) && value.every(v => v && typeof v === "object") ? value : fail("invalid resource list");
  for (const resource of [...list(json.buffers), ...list(json.images)]) if (resource.uri !== undefined) fail("GLB must embed buffers and images; external/data URIs are not admitted");
  const accessors = list(json.accessors);
  if (accessors.some(accessor => !Number.isInteger(accessor.count) || Number(accessor.count) < 1 || Number(accessor.count) > Math.max(512, review.maxTriangles * 3))) fail("accessor allocation exceeds reviewed geometry budget");
  if (list(json.buffers).some(buffer => !Number.isInteger(buffer.byteLength) || Number(buffer.byteLength) < 0 || Number(buffer.byteLength) > 64 * 1024 * 1024)) fail("buffer allocation exceeds safety limit");
  if (list(json.cameras).length) fail("embedded camera");
  if (!review.allowSceneLights && list(json.extensions?.KHR_lights_punctual?.lights).length) fail("embedded scene light");
  if (hasPlaceholderMetadata(json)) fail("placeholder metadata");
  if (list(json.scenes).length !== 1 || (json.scene !== undefined && json.scene !== 0)) fail("hero GLB must contain exactly one scene");
  for (const mesh of list(json.meshes)) for (const primitive of list(mesh.primitives)) {
    if (primitive.mode !== undefined && ![4, 5, 6].includes(Number(primitive.mode))) fail("hero primitives must be triangles, triangle strips or triangle fans");
  }
  return json;
}

function hasPlaceholderMetadata(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  for (const [key, child] of Object.entries(value)) {
    if ((/^(sidtwPlaceholder|sitwPlaceholder|placeholder|isPlaceholder)$/i.test(key) && child === true)
      || (key === "generator" && typeof child === "string" && /(?:SIDTW|SITW).*placeholder|placeholder.*(?:generator|asset|model)/i.test(child))) return true;
    if (child && typeof child === "object" && hasPlaceholderMetadata(child)) return true;
  }
  return false;
}

/** GLTFLoader can resolve a scene with a null map after a failed image decode.
 * Only maps required by materials actually used by this scene are checked. */
export function validateRequiredHeroTextures(asset: GLTF, material: THREE.Material) {
  const materialIndex = asset.parser?.associations?.get(material)?.materials;
  const definition = materialIndex === undefined ? undefined : asset.parser.json.materials?.[materialIndex];
  if (!definition) return;
  const required: [unknown, string][] = [[definition.pbrMetallicRoughness?.baseColorTexture, "map"]];
  if (!definition.extensions?.KHR_materials_unlit) {
    required.push([definition.pbrMetallicRoughness?.metallicRoughnessTexture, "metalnessMap"], [definition.pbrMetallicRoughness?.metallicRoughnessTexture, "roughnessMap"], [definition.normalTexture, "normalMap"], [definition.occlusionTexture, "aoMap"], [definition.emissiveTexture, "emissiveMap"]);
    const extensions: Record<string, Record<string, string>> = {
      KHR_materials_clearcoat: { clearcoatTexture: "clearcoatMap", clearcoatRoughnessTexture: "clearcoatRoughnessMap", clearcoatNormalTexture: "clearcoatNormalMap" },
      KHR_materials_sheen: { sheenColorTexture: "sheenColorMap", sheenRoughnessTexture: "sheenRoughnessMap" },
      KHR_materials_transmission: { transmissionTexture: "transmissionMap" },
      KHR_materials_volume: { thicknessTexture: "thicknessMap" },
      KHR_materials_specular: { specularTexture: "specularIntensityMap", specularColorTexture: "specularColorMap" },
      KHR_materials_iridescence: { iridescenceTexture: "iridescenceMap", iridescenceThicknessTexture: "iridescenceThicknessMap" },
      KHR_materials_anisotropy: { anisotropyTexture: "anisotropyMap" },
    };
    for (const [extension, channels] of Object.entries(extensions)) for (const [texture, channel] of Object.entries(channels)) {
      if (definition.extensions?.[extension]?.[texture] !== undefined) required.push([definition.extensions[extension][texture], channel]);
    }
  }
  for (const [reference, channel] of required) if (reference !== undefined && !(material as unknown as Record<string, THREE.Texture | null>)[channel]?.isTexture) fail(`required material texture failed: ${channel}`);
}

export type HeroAssetMetrics = { triangles: number; materials: number; textures: number; geometries: number; meshes: number; drawCalls: number; bounds: { min: number[]; max: number[] }; textureDimensions: [number, number][] };

/** Validate presentation, never infer collision or animation ownership from a GLB. */
export function validateHeroPresentation(asset: GLTF, id: HeroAssetId, review: HeroAssetReview): HeroAssetMetrics {
  if (!asset.scene || isPlaceholderNpcAsset(asset)) fail("missing scene or placeholder");
  if (asset.scenes?.length !== 1 || asset.scenes[0] !== asset.scene) fail("hero GLB must contain exactly one scene");
  if (asset.cameras?.length) fail("embedded camera");
  const materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), geometries = new Set<THREE.BufferGeometry>();
  let triangles = 0, meshes = 0, drawCalls = 0;
  asset.scene.updateMatrixWorld(true);
  asset.scene.traverse(object => {
    if (hasPlaceholderMetadata(object.userData)) fail("placeholder node");
    if (!object.matrixWorld.elements.every(Number.isFinite)) fail("non-finite transform");
    if ((object as THREE.Camera).isCamera) fail("embedded camera");
    if ((object as THREE.Light).isLight && (!review.allowSceneLights || id === "master-lantern")) fail("embedded scene light");
    if (!(object as THREE.Mesh).isMesh) {
      if ((object as THREE.Points).isPoints || (object as THREE.Line).isLine || (object as THREE.Mesh).geometry) fail("non-mesh hero primitive");
      return;
    }
    const mesh = object as THREE.Mesh, geometry = mesh.geometry, positions = geometry.getAttribute("position");
    if (!positions || positions.itemSize !== 3 || positions.count < 3) fail("empty geometry");
    for (const attribute of [...Object.values(geometry.attributes), ...Object.values(geometry.morphAttributes).flat()]) {
      for (let i = 0; i < attribute.count; i++) for (let axis = 0; axis < attribute.itemSize; axis++) if (!Number.isFinite(attribute.getComponent(i, axis))) fail("non-finite geometry attribute");
    }
    const index = geometry.index;
    if (index) for (let i = 0; i < index.count; i++) if (!Number.isInteger(index.getX(i)) || index.getX(i) < 0 || index.getX(i) >= positions.count) fail("invalid index");
    const count = index?.count ?? positions.count;
    if (count % 3) fail("incomplete triangle");
    const instances = (mesh as THREE.InstancedMesh).isInstancedMesh ? (mesh as THREE.InstancedMesh).count : 1;
    if (!Number.isInteger(instances) || instances < 1) fail("invalid instances");
    triangles += count / 3 * instances; meshes++; drawCalls += Array.isArray(mesh.material) ? geometry.groups.length : 1; geometries.add(geometry);
    for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
      materials.add(material);
      validateRequiredHeroTextures(asset, material);
      const pbr = material as THREE.MeshStandardMaterial;
      if (![material.opacity, ...(pbr.color?.toArray() ?? []), ...(pbr.emissive?.toArray() ?? []), pbr.roughness ?? 1, pbr.metalness ?? 0, pbr.emissiveIntensity ?? 0].every(Number.isFinite)) fail("non-finite material");
      if (id === "key" || id === "master-lantern") if (pbr.emissive?.getHex() && pbr.emissiveIntensity > 0) fail("housing/key must not own glow");
      for (const value of Object.values(material)) if (value && (value as THREE.Texture).isTexture) {
        const texture = value as THREE.Texture;
        textures.add(texture);
        const uv = texture.channel === 0 ? "uv" : `uv${texture.channel}`;
        if (!geometry.getAttribute(uv) || geometry.getAttribute(uv).count !== positions.count) fail(`mapped material missing ${uv}`);
      }
    }
  });
  if (!meshes || !triangles || triangles > review.maxTriangles || materials.size > review.maxMaterials || textures.size > review.maxTextures) fail("geometry/material/texture budget");
  const textureDimensions: [number, number][] = [];
  for (const texture of textures) {
    const image = texture.image as { width?: number; height?: number } | undefined;
    const width = image?.width ?? 0, height = image?.height ?? 0;
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > review.maxTextureDimension || height > review.maxTextureDimension) fail("texture dimensions");
    textureDimensions.push([width, height]);
  }
  const box = new THREE.Box3().setFromObject(asset.scene, true);
  const min = box.min.toArray(), max = box.max.toArray(), size = box.getSize(new THREE.Vector3());
  if (box.isEmpty() || ![...min, ...max].every(Number.isFinite) || size.length() < .001) fail("invalid bounds");
  if (min.some((v, axis) => v < review.bounds.min[axis] - .001 || max[axis] > review.bounds.max[axis] + .001)) fail("outside reviewed envelope");
  if (review.baseY && Math.abs(min[1] - review.baseY.value) > review.baseY.tolerance + .001) fail("base does not match reviewed origin");
  if (id === "master-lantern" && (Math.abs(min[1]) > .03 || Math.abs(max[1] - 1.18) > .06 || Math.max(Math.abs(min[0]), Math.abs(max[0]), Math.abs(min[2]), Math.abs(max[2])) > .32)) fail("lantern housing scale/origin");
  return { triangles, materials: materials.size, textures: textures.size, geometries: geometries.size, meshes, drawCalls, bounds: { min, max }, textureDimensions };
}

/** Dispose full or partially parsed resources, including rejected non-mesh primitives.
 * Typed resources are deduplicated; arbitrary asset extras are never interpreted. */
export function disposeHeroResources(values: Iterable<unknown>) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>(), skeletons = new Set<THREE.Skeleton>();
  const visited = new Set<unknown>();
  function collect(value: unknown) {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);
    if (Array.isArray(value)) { value.forEach(collect); return; }
    if ((value as THREE.BufferGeometry).isBufferGeometry) geometries.add(value as THREE.BufferGeometry);
    else if ((value as THREE.Texture).isTexture) textures.add(value as THREE.Texture);
    else if ((value as THREE.Material).isMaterial) {
      materials.add(value as THREE.Material);
      Object.values(value).forEach(child => { if (child?.isTexture) collect(child); });
    } else if ((value as THREE.Object3D).isObject3D) {
      const object = value as THREE.Mesh;
      collect(object.geometry); collect(object.material);
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) skeletons.add((object as THREE.SkinnedMesh).skeleton);
      object.children.forEach(collect);
    }
  }
  for (const value of values) collect(value);
  geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); skeletons.forEach(s => s.dispose());
  const images = new Set<ImageBitmap>();
  textures.forEach(t => { if (typeof ImageBitmap !== "undefined" && t.image instanceof ImageBitmap) images.add(t.image); t.dispose(); });
  images.forEach(image => image.close());
}

/** Source resources belong to the shared cache, never a mounted model instance. */
export function disposeHeroSource(asset: GLTF) {
  disposeHeroResources(asset.scenes?.length ? asset.scenes : [asset.scene]);
}
