type Point = [number, number, number];
export type LightShaftSpec = { from: Point; to: Point; radius: number; opacity: number };
export type SkyReturn = { position: Point; color: string; intensity: number };

/** One non-shadowing sky return, inside the existing scene lighting authority.
 * Interiors, stillness and the epilogue keep their deliberately sparse light. */
export function sceneSkyReturn(sceneId: string): SkyReturn | null {
  if (["enchanted.rabbit-hole", "enchanted.friendship-meadow", "enchanted.masked-hearth"].includes(sceneId)) return { position: [9, 6, -9], color: "#a6bdca", intensity: .22 };
  if (sceneId === "blue-moon.sanctuary" || sceneId === "blue-moon.intimacy") return { position: [-10, 6, -8], color: "#8cacc8", intensity: .14 };
  if (sceneId === "nest.two-hands" || sceneId === "nest.protection") return { position: [-8, 5, 8], color: "#bbcdd1", intensity: .16 };
  if (["crowned.threshold", "crowned.home", "crowned.sovereignty"].includes(sceneId)) return { position: [9, 6, 12], color: "#bdcdd5", intensity: .18 };
  return null;
}

/** At most three bounded shafts. Moon shafts graze the banks, not the hero. */
export const AUTHORED_SHAFTS: Readonly<Record<string, readonly LightShaftSpec[]>> = {
  "broken-floor.confession": [{ from: [5.8, 5.2, -6], to: [-1, .25, 2], radius: 2.6, opacity: .025 }],
  "enchanted.rabbit-hole": [
    { from: [-7, 13, 8], to: [-2, 0, 5], radius: 2.8, opacity: .035 },
    { from: [-5, 14, 15], to: [2, 0, 10], radius: 2, opacity: .025 },
    { from: [-9, 14, 3], to: [5.4, .05, -.8], radius: 1.1, opacity: .016 },
  ],
  "enchanted.friendship-meadow": [
    { from: [-7, 13, 8], to: [0, 0, 4], radius: 3, opacity: .03 },
    { from: [-8, 14, 1], to: [6.2, .05, -3], radius: 1.5, opacity: .017 },
  ],
  "enchanted.masked-hearth": [{ from: [-7, 13, 8], to: [-6.5, .1, 1], radius: 1.2, opacity: .014 }],
  "blue-moon.sanctuary": [
    { from: [6, 18, 38], to: [-9.1, .1, 4], radius: 1.4, opacity: .012 },
    { from: [6, 18, 38], to: [9.4, .1, 7], radius: 1.1, opacity: .01 },
  ],
  "blue-moon.intimacy": [{ from: [6, 18, 38], to: [9.4, .1, 7], radius: 1.1, opacity: .009 }],
  "nest.two-hands": [{ from: [8, 11, -7], to: [2.6, .1, 3], radius: 1.6, opacity: .016 }],
  "nest.protection": [{ from: [8, 11, -7], to: [-2.8, .1, 3], radius: 2, opacity: .018 }],
  "thorned.self-owned-world": [{ from: [0, 5, 12], to: [0, .2, 3], radius: 2.2, opacity: .035 }],
  "wolf-swan.convergence": [{ from: [-8, 14, 5], to: [3.8, .1, 6], radius: 1.8, opacity: .016 }],
  "river.wash": [{ from: [12, 18, 6], to: [8, .1, 9], radius: 1.5, opacity: .012 }],
  "crowned.threshold": [{ from: [-12, 9, -6], to: [-3.5, .1, 6], radius: 2, opacity: .018 }],
  "crowned.home": [{ from: [-8, 6, -4], to: [1, .1, 4], radius: 3.4, opacity: .025 }],
  "crowned.sovereignty": [{ from: [-8, 6, -4], to: [1, .1, 4], radius: 3.4, opacity: .025 }],
};
