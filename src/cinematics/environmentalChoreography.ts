/** Persisted story states are the sole authority for environmental responses. */
export function resolveEnvironmentalChoreography(states: Readonly<Record<string, string>>) {
  const table = states["thorn-house.table"];
  return {
    candlesLit: states["blue-moon.candle"] === "lit",
    waterTouched: states["blue-moon.water"] === "rippled",
    cageReflected: ["reflected-cage", "physical-cage"].includes(states["blue-moon.cage-mirror"]),
    cagePhysical: states["blue-moon.cage-mirror"] === "physical-cage",
    handsOccupied: Number(states["nest.protected-linen"] === "carried") + Number(states["nest.responsibility"] === "carried"),
    daysCompressed: states["nest.day"] === "compressed" && states["nest.responsibility"] !== "placed",
    responsibilityResting: states["nest.responsibility"] === "placed",
    houseCompression: table === "refilled-twice" || table === "waiting-again" ? 1 : table === "refilled" ? 0.5 : 0,
    houseRefilled: table === "refilled" || table === "refilled-twice",
    sootWashed: states["river.soot"] === "washed",
    sootLoosening: states["river.soot"] === "loosening",
    surrendered: states["river.white-fabric"] === "raised",
    pastReturned: ["entered", "looped"].includes(states["fork.past"]),
    pastQuiet: states["fork.mark"] === "erased" || states["fork.hope"] === "released",
    heartMemory: states["heart.memory"] ?? "",
    creation: states["womb.creation"] ?? "",
  };
}
export type EnvironmentalCueState = ReturnType<typeof resolveEnvironmentalChoreography>;

/** Read elapsed active time from the existing scene clock. Paused clocks and
 * resets contribute nothing; a resumed frame cannot replay background time. */
export function environmentalResponseDelta(now: number, previous: number, motion: number) {
  if (![now, previous, motion].every(Number.isFinite) || motion <= .0001 || now <= previous) return 0;
  return Math.min(.05, (now - previous) / motion);
}

/** Three finite wavefronts follow an accepted touch, then leave still water. */
export function acceptedWaterWave(elapsed: number, index: number, target = { scale: .5, opacity: 0 }) {
  const age = elapsed - index * .62;
  const progress = Math.max(0, Math.min(1, age / 4.8));
  target.scale = .5 + progress * 3.6;
  target.opacity = age > 0 && age < 4.8 ? Math.sin(progress * Math.PI) * (1 - progress) * .2 : 0;
  return target;
}
