import * as THREE from "three";
import { createLanternHousingGeometry, createLanternGlassGeometry } from "../components/three/environmentArt/heroGeometry.ts";
import { createReviewedLanternHousingGeometry, shapeReviewedLanternFlame } from "./playerLanternArt.ts";

/** Exact original geometry factory, retained for baseline review and callers.
 * Selected housing is built once without discarding a complete baseline set.
 */
export function createPlayerLanternGeometries(housingBuilder: () => THREE.BufferGeometry = createLanternHousingGeometry) {
    const glow = new THREE.PlaneGeometry(0.54, 0.54);
    const glass = createLanternGlassGeometry();
    glass.scale(.44, .44, .44); glass.translate(0, -.208, 0);

    const flame = new THREE.LatheGeometry(
      [
        new THREE.Vector2(0, -0.09),
        new THREE.Vector2(0.043, -0.065),
        new THREE.Vector2(0.052, -0.018),
        new THREE.Vector2(0.038, 0.042),
        new THREE.Vector2(0.017, 0.098),
        new THREE.Vector2(0, 0.135),
      ],
      12,
    );
    const position = flame.getAttribute("position");
    const flameColors: number[] = [];
    const pale = new THREE.Color("#ffd88a");
    const amber = new THREE.Color("#ff9b32");
    const ember = new THREE.Color("#bd3b12");
    const sampleColor = new THREE.Color();
    for (let index = 0; index < position.count; index += 1) {
      const height = THREE.MathUtils.clamp((position.getY(index) + 0.09) / 0.225, 0, 1);
      if (height < 0.58) sampleColor.copy(pale).lerp(amber, height / 0.58);
      else sampleColor.copy(amber).lerp(ember, (height - 0.58) / 0.42);
      flameColors.push(sampleColor.r, sampleColor.g, sampleColor.b);
    }
    flame.setAttribute("color", new THREE.Float32BufferAttribute(flameColors, 3));

    const metal = housingBuilder();
    metal.scale(.44, .44, .44); metal.translate(0, -.208, 0);
    flame.scale(.76, .8, .76);

    return { glow, glass, flame, metal };
  }

export { createPlayerLanternGeometries as createBaselinePlayerLanternGeometries };

/** The reviewed native carried fallback shares the original glass, glow, flame
 * topology and resource owner; only housing detail/colour and wick shape vary. */
export function createReviewedPlayerLanternGeometries() {
  const geometries = createPlayerLanternGeometries(createReviewedLanternHousingGeometry);
  shapeReviewedLanternFlame(geometries.flame);
  return geometries;
}
