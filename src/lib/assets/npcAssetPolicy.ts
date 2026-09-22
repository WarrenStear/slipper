import * as THREE from "three";
import { clone } from "three/examples/jsm/utils/SkeletonUtils.js";

/** Only explicit placeholder metadata selects the fallback; small authored assets remain valid. */
export function isPlaceholderNpcAsset(asset: { asset?: { generator?: string }; scene: THREE.Object3D; parser?: { json?: { asset?: { generator?: string } } } }) {
  const generator = asset.asset?.generator ?? asset.parser?.json?.asset?.generator ?? "";
  if (/SIDTW placeholder NPC generator/i.test(generator)) return true;
  return asset.scene.userData.sidtwPlaceholder === true;
}

/** Own materials and skeletons, while retaining cached geometry/textures shared by the loader. */
export function cloneNpcPresentation(source: THREE.Object3D, opacity = 1) {
  const scene = clone(source);
  const materials = new Map<THREE.Material, THREE.Material>();
  const alpha = Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : 1));
  function ownMaterial(sourceMaterial: THREE.Material) {
    let material = materials.get(sourceMaterial);
    if (!material) {
      material = sourceMaterial.clone();
      material.opacity = sourceMaterial.opacity * alpha;
      material.transparent = sourceMaterial.transparent || alpha < 1;
      material.depthWrite = alpha < 1 ? false : sourceMaterial.depthWrite;
      materials.set(sourceMaterial, material);
    }
    return material;
  }
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = false; object.receiveShadow = true; object.frustumCulled = true;
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material);
  });
  return { scene, dispose: () => {
    for (const material of materials.values()) material.dispose();
    scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) object.skeleton.dispose(); });
  } };
}
