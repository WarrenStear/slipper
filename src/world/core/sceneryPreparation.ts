import { Object3D, type Camera, type Mesh, type MeshStandardMaterial, type Scene, type WebGLRenderer } from "three";
import { prepareMaterialMapsForCompile } from "../../components/three/materials/productionMaterialRuntime.ts";

// Preparation stays inside the existing beauty pass, so tone mapping, fog and
// light variants match their first draw. No extra render or retained materials.
const queues = new WeakMap<Scene, Set<{ root: Object3D; started: number | null }>>();
export const SCENERY_COMPILE_LEAD_MS = 250;
export function queueSceneryPreparation(scene: Scene, root: Object3D) {
  let queue = queues.get(scene);
  if (!queue) { queue = new Set(); queues.set(scene, queue); }
  const entry = { root, started: null }; queue.add(entry); root.visible = false;
  return () => { queue.delete(entry); root.visible = true; };
}

/** Start at most one small region per frame. Give parallel compilation a bounded
 * lead before visibility; this is not a promise that a particular GPU is ready.
 * Cancellation has no outstanding async work touching disposed scene resources. */
export function prepareStreamedScenery(renderer: WebGLRenderer, scene: Scene, camera: Camera, now: number) {
  const queue = queues.get(scene); if (!queue?.size) return;
  const parallel = renderer.extensions.has("KHR_parallel_shader_compile");
  let started = false;
  for (const entry of queue) {
    if (!parallel || (entry.started !== null && now - entry.started >= SCENERY_COMPILE_LEAD_MS)) {
      entry.root.visible = true; queue.delete(entry); continue;
    }
    if (entry.started !== null || started) continue;
    const receivers: Mesh[] = [], materials = new Set();
    entry.root.traverse(object => {
      const mesh = object as Mesh;
      if (!mesh.isMesh || Array.isArray(mesh.material) || !mesh.material.visible) return;
      receivers.push(mesh); materials.add(mesh.material);
    });
    if (receivers.length > 512 || materials.size > 128) { entry.root.visible = true; queue.delete(entry); continue; }
    const view = new Object3D();
    view.traverseVisible = () => undefined;
    view.traverse = visit => {
      for (const mesh of receivers) {
        if (!Array.isArray(mesh.material) && mesh.material.type === "MeshStandardMaterial") prepareMaterialMapsForCompile(mesh.material as MeshStandardMaterial, renderer, scene, camera, mesh);
        visit(mesh);
      }
    };
    renderer.compile(view, camera, scene);
    entry.started = now; started = true;
  }
}
