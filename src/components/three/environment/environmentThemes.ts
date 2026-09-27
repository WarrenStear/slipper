import { landscapeForScene, type LandscapeFamily } from "./landscapeGeography.ts";

export type EnvironmentBiome = LandscapeFamily | "sanctuary";
export type EnvironmentTheme = Readonly<{
  id: EnvironmentBiome;
  soil: string; moss: string; rock: string; bark: string; leaf: string; grass: string; flower: string;
  evergreen: string; evergreenScale: number; meadowFlowers: boolean;
  water: Readonly<{ color: string; flow: number; roughness: number; depth: number }>;
}>;

/** Material/ecology choices complement SceneLookRegistry, never replace its
 * lighting, fog, emotional timing or story authority. All colours are sRGB. */
export const ENVIRONMENT_THEMES: Readonly<Record<EnvironmentBiome, EnvironmentTheme>> = {
  woodland: { id: "woodland", soil: "#8c795d", moss: "#75885c", rock: "#879083", bark: "#96836b", leaf: "#879962", grass: "#869661", flower: "#b9b6cd", evergreen: "#697e69", evergreenScale: .85, meadowFlowers: false, water: { color: "#294d49", flow: .38, roughness: .27, depth: .75 } },
  sanctuary: { id: "sanctuary", soil: "#51616a", moss: "#627d76", rock: "#829399", bark: "#7d8784", leaf: "#748e87", grass: "#8b9d89", flower: "#cedce2", evergreen: "#536d71", evergreenScale: 0, meadowFlowers: false, water: { color: "#0b1720", flow: 0, roughness: .24, depth: .9 } },
  meadow: { id: "meadow", soil: "#a28c6a", moss: "#8c9b6a", rock: "#a2a28c", bark: "#a19376", leaf: "#a4af79", grass: "#a5ac77", flower: "#e3d8b2", evergreen: "#768a74", evergreenScale: .68, meadowFlowers: true, water: { color: "#476665", flow: .22, roughness: .3, depth: .7 } },
  riverbank: { id: "riverbank", soil: "#817b69", moss: "#6c8773", rock: "#929e99", bark: "#938c7a", leaf: "#8da28a", grass: "#94a68c", flower: "#b9c5bf", evergreen: "#667e74", evergreenScale: .72, meadowFlowers: false, water: { color: "#304d59", flow: .64, roughness: .29, depth: .8 } },
  upland: { id: "upland", soil: "#a0967b", moss: "#8a946f", rock: "#a5a69d", bark: "#a19785", leaf: "#95a18b", grass: "#acb08d", flower: "#c7bbc9", evergreen: "#708276", evergreenScale: .96, meadowFlowers: false, water: { color: "#466268", flow: .55, roughness: .28, depth: .74 } },
  highland: { id: "highland", soil: "#909284", moss: "#7f917e", rock: "#afb4ae", bark: "#989b91", leaf: "#8d9e90", grass: "#a1ad9a", flower: "#c1c4d1", evergreen: "#6c837e", evergreenScale: 1.08, meadowFlowers: false, water: { color: "#426272", flow: .72, roughness: .26, depth: .8 } },
  home: { id: "home", soil: "#b39a70", moss: "#94a575", rock: "#ada991", bark: "#b19a77", leaf: "#a2b277", grass: "#b5bb80", flower: "#eeddb0", evergreen: "#7b9071", evergreenScale: .8, meadowFlowers: true, water: { color: "#48685f", flow: .24, roughness: .3, depth: .66 } },
};
for (const theme of Object.values(ENVIRONMENT_THEMES)) { Object.freeze(theme.water); Object.freeze(theme); }
Object.freeze(ENVIRONMENT_THEMES);

export function environmentThemeForScene(sceneId: string): EnvironmentTheme | null {
  if (["blue-moon.sanctuary", "blue-moon.intimacy", "blue-moon.caged-bird"].includes(sceneId)) return ENVIRONMENT_THEMES.sanctuary;
  const spec = landscapeForScene(sceneId);
  return spec ? ENVIRONMENT_THEMES[spec.family] : null;
}

/** Extra ecology is optional: the existing low-tier forest is never removed. */
export const BIOME_ECOLOGY_CAPACITY = Object.freeze({ evergreens: 10, grass: 72, flowers: 24 });
export function biomeEcologyBudget(quality: string, reducedEffects = false) {
  const tier = reducedEffects ? 0 : Math.max(0, ["low", "medium", "high", "cinematic"].indexOf(quality));
  return { evergreens: [0, 2, 6, 10][tier], grass: [0, 20, 44, 72][tier], flowers: [0, 6, 14, 24][tier] };
}
