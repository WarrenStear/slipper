import type { Object3D, SpotLight } from "three";
import type { createPlayerLanternGeometries } from "./playerLanternGeometry.ts";
import type { createPlayerLanternMaterials } from "./playerLanternMaterials.ts";

export const PLAYER_LANTERN_SHADOW_NEAR = .18;
export const PLAYER_LANTERN_SHADOW_FAR = 18;

/** Existing spot target/shadow settings. Canonical SceneLook disables its shadow. */
export function configurePlayerLanternSpot(spot: SpotLight, target: Object3D, shadowMapSize: number) {
  spot.target = target;
  spot.shadow.camera.near = PLAYER_LANTERN_SHADOW_NEAR;
  spot.shadow.camera.far = PLAYER_LANTERN_SHADOW_FAR;
  spot.shadow.camera.fov = 34;
  spot.shadow.bias = -.00006;
  spot.shadow.normalBias = .016;
  spot.shadow.mapSize.set(shadowMapSize, shadowMapSize);
}

/** One effect setup owns one cleanup. Replay creates a fresh cleanup lease so
 * any subsequent upload of these same objects is also released on unmount.
 * Material.dispose never disposes a borrowed map/hero source texture.
 */
export function createPlayerLanternResourceRelease(
  geometries: ReturnType<typeof createPlayerLanternGeometries>,
  materials: ReturnType<typeof createPlayerLanternMaterials>,
) {
  let released = false;
  return () => {
    if (released) return;
    released = true;
    materials.flame.dispose(); materials.glass.dispose(); materials.metal.dispose(); materials.glow.dispose();
    geometries.glow.dispose(); geometries.glass.dispose(); geometries.flame.dispose(); geometries.metal.dispose();
  };
}
