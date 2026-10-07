import { Frustum, Matrix4, Object3D, type Camera, type Mesh, type MeshStandardMaterial, type Scene, type WebGLRenderer } from "three";
import { prepareMaterialMapsForCompile } from "../materials/productionMaterialRuntime.ts";

// The measured first-memory arrival had 30 expensive standard-material variants.
// These caps bound preparation of its actual visible receivers; overflow takes
// the unchanged normal render path without partially admitting any maps.
export const FIRST_WOOD_PREPARATION_LIMITS = { objects: 512, materials: 128 } as const;

/** Enqueue the measured beauty variants together before their normal first use.
 * This adds no draw, target, private material, async readiness gate or frame owner.
 * The caller has already selected its existing beauty target. Normal rendering
 * still performs Three's shader error checks, uploads and uniform initialization.
 */
export function enqueueFirstWoodPrograms(sceneId: string, renderer: WebGLRenderer, scene: Scene, camera: Camera) {
  if (sceneId !== "enchanted.rabbit-hole" || !renderer.extensions.has("KHR_parallel_shader_compile")) return false;
  if (scene.matrixWorldAutoUpdate) scene.updateMatrixWorld();
  if (camera.parent === null && camera.matrixWorldAutoUpdate) camera.updateMatrixWorld();
  const frustum = new Frustum().setFromProjectionMatrix(new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse), camera.coordinateSystem);
  const receivers: Mesh[] = [], materials = new Set<MeshStandardMaterial>();
  let overflow = false;
  scene.traverseVisible(object => {
    if (overflow || !object.layers.test(camera.layers)) return;
    const mesh = object as Mesh;
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.material.type !== "MeshStandardMaterial" || !mesh.material.visible) return;
    if (mesh.frustumCulled && !frustum.intersectsObject(mesh)) return;
    receivers.push(mesh); materials.add(mesh.material as MeshStandardMaterial);
    overflow = receivers.length > FIRST_WOOD_PREPARATION_LIMITS.objects || materials.size > FIRST_WOOD_PREPARATION_LIMITS.materials;
  });
  if (overflow || receivers.length === 0) return false;

  // A traversal view, never attached or rendered. Visit the original meshes so
  // instancing, morphs, vertex colors and guarded samplers keep their real variants.
  // Lighting/fog comes exclusively from the actual target scene; no second scene
  // or copied/reparented mesh is created, and its lights are not counted twice.
  const view = new Object3D();
  view.traverseVisible = () => undefined;
  view.traverse = visit => {
    for (const mesh of receivers) {
      prepareMaterialMapsForCompile(mesh.material as MeshStandardMaterial, renderer, scene, camera, mesh);
      visit(mesh);
    }
  };
  renderer.compile(view, camera, scene);
  return true;
}
