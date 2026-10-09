import type { StorySurface } from "../storyEvents/tactileShader.ts";

/** Durable material identity; chapter state changes weathering, never the asset. */
export const MATERIAL_LIBRARY = {
  wornTimber: { surface: "wood", roughness: .86, metalness: 0 },
  wetTimber: { surface: "wet-wood", roughness: .48, metalness: 0 },
  agedMirrorFrame: { surface: "metal", roughness: .48, metalness: .72 },
  linen: { surface: "linen", roughness: .96, metalness: 0 },
  readingVelvet: { surface: "velvet", roughness: .98, metalness: 0 },
  charredWood: { surface: "charred-wood", roughness: .97, metalness: 0 },
  riverStone: { surface: "stone", roughness: .9, metalness: 0 },
  livedPlaster: { surface: "plaster", roughness: .95, metalness: 0 },
  bark: { surface: "bark", roughness: .94, metalness: 0 },
  moss: { surface: "moss", roughness: .98, metalness: 0 },
  dampSoil: { surface: "earth", roughness: .9, metalness: 0 },
  ash: { surface: "ash", roughness: 1, metalness: 0 },
  oxidisedBrass: { surface: "metal", roughness: .62, metalness: .74 },
  agedPaper: { surface: "paper", roughness: .96, metalness: 0 },
  candleWax: { surface: "wax", roughness: .82, metalness: 0 },
  paintedTimber: { surface: "painted-wood", roughness: .9, metalness: 0 },
} satisfies Record<string, { surface: StorySurface; roughness: number; metalness: number }>;

/** Shared defaults, not forced overrides. Authored colours, textures and explicit
 * finish choices retain priority in every chapter and at every quality tier. */
export const SURFACE_DEFAULTS = Object.freeze({
  wood: MATERIAL_LIBRARY.wornTimber, "wet-wood": MATERIAL_LIBRARY.wetTimber,
  "charred-wood": MATERIAL_LIBRARY.charredWood, "painted-wood": MATERIAL_LIBRARY.paintedTimber,
  bark: MATERIAL_LIBRARY.bark, moss: MATERIAL_LIBRARY.moss, earth: MATERIAL_LIBRARY.dampSoil,
  stone: MATERIAL_LIBRARY.riverStone, linen: MATERIAL_LIBRARY.linen, velvet: MATERIAL_LIBRARY.readingVelvet,
  paper: MATERIAL_LIBRARY.agedPaper, plaster: MATERIAL_LIBRARY.livedPlaster, ash: MATERIAL_LIBRARY.ash,
  wax: MATERIAL_LIBRARY.candleWax, metal: MATERIAL_LIBRARY.oxidisedBrass,
} satisfies Record<StorySurface, { roughness: number; metalness: number }>);

export function resolveSurfaceDefaults(surface: StorySurface, roughness?: number, metalness?: number) {
  const defaults = SURFACE_DEFAULTS[surface];
  return {
    roughness: typeof roughness === "number" && Number.isFinite(roughness) ? Math.max(0, Math.min(1, roughness)) : defaults.roughness,
    metalness: typeof metalness === "number" && Number.isFinite(metalness) ? Math.max(0, Math.min(1, metalness)) : defaults.metalness,
  };
}

/** Presentation-only projection of accepted, persisted canonical outcomes. */
export function resolveMaterialHistory(objects: Readonly<Record<string, string>>, flags: Readonly<Record<string, boolean>>) {
  const fireTouched = flags["fire.boundary-burned"] === true ||
    ["fire.false-promise", "fire.old-marker", "fire.empty-frame", "fire.broken-key", "fire.dead-flower", "fire.letter"].some(id => objects[id] === "burned") || objects["fire.true-memory"] === "preserved";
  const washed = flags["river.grief-washed"] === true && objects["river.soot"] === "washed";
  return {
    fireTouched,
    soot: fireTouched ? washed ? .12 : objects["river.soot"] === "loosening" ? .28 : .48 : 0,
    washed,
    mirrorScarred: flags["mirror.reflections-truthful"] === true && objects["sunset.truth"] === "synchronised",
    integrated: flags["integration.three-aspects-held"] === true && objects["integration.meeting"] === "aligned" || objects["home.crown-mirror"] === "integrated",
  };
}
export type MaterialHistory = ReturnType<typeof resolveMaterialHistory>;
export type MaterialMemory = { wetness?: number; wear?: number; damage?: number; reintegrated?: boolean;
  /** Existing fire remains opt in by surface; later mirror frames opt in explicitly. */
  history?: MaterialHistory; receiver?: "remembered-frame"; rememberedScene?: boolean };

const unit = (value = 0) => Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
const WETTABLE = new Set<StorySurface>(["wood", "wet-wood", "bark", "stone", "earth", "moss", "painted-wood"]);

export function resolveMaterialMemory(surface: StorySurface, roughness: number, memory: MaterialMemory = {}) {
  let wetness = WETTABLE.has(surface) ? unit(memory.wetness) : 0;
  const wear = unit(memory.wear);
  let damage = unit(memory.damage), soot = 0;
  const history = memory.history;
  const remnant = surface === "charred-wood" || surface === "ash";
  const rememberedFrame = surface === "wood" && memory.receiver === "remembered-frame" && memory.rememberedScene === true;
  if (history && (remnant || rememberedFrame)) {
    // These are already burned receivers, or the explicitly remembered frame.
    // Unrelated floors, foliage, paper, linen and brass keep authored weathering.
    if (history.fireTouched === true) {
      soot = unit(history.soot) * (remnant ? 1 : .35);
      damage = Math.max(damage, remnant ? .32 : .24);
    }
    if (rememberedFrame && history.mirrorScarred === true) damage = Math.max(damage, .38);
    if (history.washed === true && (rememberedFrame || history.fireTouched === true)) {
      wetness = Math.max(wetness, remnant ? .3 : .22);
    }
  }
  return {
    // Washing lifts soot, not scars. Reintegration never substitutes a new prop.
    surface, wetness, wear, damage,
    roughness: Math.max(.28, Math.min(1, unit(roughness) - wetness * .18 + damage * .04 + soot * .035)),
    brightness: 1 - wetness * .12 - damage * .1 - soot * .12 + (memory.reintegrated ? .015 : 0),
  };
}
