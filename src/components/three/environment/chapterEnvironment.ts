/** Authored presentation data. No story writes, random seeds, or persisted state. */
export type EnvironmentFamily = "broken-floor" | "blue-moon" | "thorned-house" | "enchanted-wood" | "lantern-epilogue";
export type Point3 = [number, number, number];
export type EnvironmentQuality = "low" | "medium" | "high" | "cinematic";
export type EnvironmentPreset = Readonly<{
  fogColor: string; fogScale: number; keyColor: string; keyIntensity: number;
  keyPosition: Point3; keyTarget: Point3; keyType: "directional" | "spot"; reducedKeyScale?: number;
}>;

export const CHAPTER_ENVIRONMENTS: Readonly<Record<EnvironmentFamily, EnvironmentPreset>> = {
  "enchanted-wood": { fogColor: "#26362e", fogScale: .9, keyColor: "#d9dab4", keyIntensity: .95, keyPosition: [-7, 13, 8], keyTarget: [0, .1, 3], keyType: "directional", reducedKeyScale: .8 },
  "lantern-epilogue": { fogColor: "#17272c", fogScale: .72, keyColor: "#c6dbe6", keyIntensity: .62, keyPosition: [-7, 12, -7], keyTarget: [0, 0, 0], keyType: "directional", reducedKeyScale: .38 / .62 },
  "broken-floor": { fogColor: "#182125", fogScale: .75, keyColor: "#aac4d1", keyIntensity: .85, keyPosition: [5.8, 5.2, -6], keyTarget: [0, 0, .3], keyType: "directional" },
  "blue-moon": { fogColor: "#162b35", fogScale: 1.15, keyColor: "#b9d9ed", keyIntensity: 1.6, keyPosition: [6, 18, 38], keyTarget: [0, 0, 3], keyType: "directional" },
  "thorned-house": { fogColor: "#251c17", fogScale: .45, keyColor: "#efc08b", keyIntensity: 22, keyPosition: [-3.8, 3.1, -.4], keyTarget: [-1, .25, 3.2], keyType: "spot" },
};

export function environmentFamily(sceneId: string): EnvironmentFamily | null {
  if (sceneId === "broken-floor.confession") return "broken-floor";
  if (["enchanted.rabbit-hole", "enchanted.friendship-meadow", "enchanted.masked-hearth"].includes(sceneId)) return "enchanted-wood";
  if (sceneId === "epilogue.constellation") return "lantern-epilogue";
  if (["blue-moon.sanctuary", "blue-moon.intimacy", "blue-moon.caged-bird"].includes(sceneId)) return "blue-moon";
  if (["thorned.locked-garden", "thorned.old-memory-bedroom", "thorned.self-owned-world"].includes(sceneId)) return "thorned-house";
  return null;
}
export function environmentBudget(quality: EnvironmentQuality, reducedEffects: boolean) {
  const tier = reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
  return { trees: [12, 18, 24, 30][tier], stones: [18, 24, 30, 36][tier], reeds: [16, 24, 32, 40][tier], tier };
}
export function environmentFogDensity(authoredDensity: number, visibility: number, family: EnvironmentFamily | null, reducedEffects = false) {
  const base = Math.max(0, Number.isFinite(authoredDensity) ? authoredDensity : .008)
    * Math.min(1.3, 90 / Math.max(1, Number.isFinite(visibility) ? visibility : 90));
  return family ? Math.min(.025, base * CHAPTER_ENVIRONMENTS[family].fogScale * (reducedEffects ? .8 : 1)) : base;
}
export function environmentTime(time: number, delta: number, active: boolean, reducedMotion: boolean) {
  if (!active || reducedMotion) return time;
  return time + Math.min(.05, Math.max(0, Number.isFinite(delta) ? delta : 0));
}
const unit = (n: number) => { const value = Math.sin(n * 127.1 + 19.19) * 43758.5453; return value - Math.floor(value); };
export type DepthTree = { base: Point3; height: number; width: number; lean: number; layer: number };
/** Interleave depth bands before taking a quality prefix, so low tiers keep depth. */
export function forestDepthLayout(count: number, variant: "blue-moon" | "enchanted-wood" = "blue-moon"): DepthTree[] {
  return Array.from({ length: Math.min(30, Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0)) }, (_, i) => {
    const layer = Math.floor(i / 2) % 3, side = i % 2 ? 1 : -1;
    if (variant === "enchanted-wood") {
      // Keep roots on the existing 16-unit ground. Depth runs along the
      // approach; inward crowns frame portrait views while trunks remain
      // clear of the unchanged pond, cloth, flowers and central path.
      return {
        base: [side * (9.6 + layer * .5 + unit(i + 4)), -.22, 1.2 + layer * 3.3 + (Math.floor(i / 6) % 2) * 1.2 + unit(i + 18) * .8 + Math.floor(i / 12) * .3],
        height: 6.8 + layer * 2.2 + unit(i + 43) * 2.9, width: .32 + unit(i + 61) * .22, lean: -side * (2.4 + unit(i + 99) * 1.1), layer,
      };
    }
    return { base: [side * (11.6 + layer * 4.1 + unit(i + 4) * 1.7), -.22, -10 + Math.floor(i / 6) * 7.5 + unit(i + 18) * 3], height: 7.8 + layer * 2.8 + unit(i + 43) * 3.8, width: .36 + unit(i + 61) * .26, lean: side * (.18 + unit(i + 99) * .55), layer };
  });
}
export type DressingForm = { position: Point3; scale: Point3; rotation?: Point3; color?: string };
/** All shoreline dressing stays outside the bridge and authored interaction area. */
export function shorelineLayout(count: number, reeds = false): DressingForm[] {
  return Array.from({ length: Math.min(40, Math.max(0, Number.isFinite(count) ? Math.floor(count) : 0)) }, (_, i) => ({
    position: [(i % 2 ? 1 : -1) * (9.9 + unit(i + 6) * 1.5), reeds ? .35 : .015, -7.7 + unit(i + 25) * 15.2],
    scale: reeds ? [.045, .55 + unit(i + 37) * .6, .045] : [.4 + unit(i + 7) * .65, .1 + unit(i + 19) * .18, .35 + unit(i + 29) * .55],
    rotation: [reeds ? unit(i + 2) * .16 : 0, unit(i + 3) * Math.PI, reeds ? .12 : unit(i + 5) * .25],
  }));
}

/** Keep the room's four walls and ceiling, but not a second floor that can
 * rise over the interactive water during the existing inversion animation. */
export function roomShellWithoutFloor(indices: ArrayLike<number>, normals: ArrayLike<number>): number[] {
  const kept: number[] = [];
  for (let i = 0; i + 2 < indices.length; i += 3) {
    const a = indices[i], b = indices[i + 1], c = indices[i + 2];
    if (normals[a * 3 + 1] < -.99 && normals[b * 3 + 1] < -.99 && normals[c * 3 + 1] < -.99) continue;
    kept.push(a, b, c);
  }
  return kept;
}
