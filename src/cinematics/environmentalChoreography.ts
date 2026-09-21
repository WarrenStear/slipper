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
