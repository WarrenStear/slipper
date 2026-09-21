/** Finite cloud/local allowlist. Checked against authored registry by tests. */
export const STORY_EVENT_SCHEMA = {
  "eventIds": [
    "epilogue.constellation.enter",
    "crowned.sovereignty.enter",
    "crowned.home.enter",
    "crowned.threshold.enter",
    "climb.womb.enter",
    "climb.heart.enter",
    "climb.mind.enter",
    "climbs.arrival.enter",
    "fork.relinquish-hope.enter",
    "fork.four-verbs.enter",
    "fork.weighing.enter",
    "river.release-surrender.enter",
    "river.wash.enter",
    "fire.boundary.enter",
    "wolf-swan.convergence.enter",
    "wolf-swan.false-choice.enter",
    "thorned.self-owned-world.enter",
    "thorned.old-memory-bedroom.enter",
    "thorned.locked-garden.enter",
    "sunset.stillness.enter",
    "sunset.true-mirror.enter",
    "sunset.warning-grove.enter",
    "nest.protection.enter",
    "nest.unsupported-cycle.enter",
    "nest.two-hands.enter",
    "blue-moon.caged-bird.enter",
    "blue-moon.intimacy.enter",
    "blue-moon.sanctuary.enter",
    "enchanted.masked-hearth.enter",
    "enchanted.friendship-meadow.enter",
    "enchanted.rabbit-hole.enter",
    "broken-floor.confession.enter",
    "broken-floor.first-wipe",
    "broken-floor.forest-revealed",
    "broken-floor.inversion",
    "enchanted.follow-light",
    "enchanted.meadow-warmth",
    "enchanted.hearth-unease",
    "blue-moon.candle-chain",
    "blue-moon.water-reveal",
    "blue-moon.swan-followed",
    "blue-moon.roses-carried",
    "blue-moon.roses-placed",
    "blue-moon.origami-awakened",
    "blue-moon.door-opened",
    "blue-moon.cage-reflected",
    "blue-moon.cage-recognised",
    "nest.first-hand",
    "nest.second-hand",
    "nest.days-compress",
    "nest.burden-set-down",
    "nest.linen-sheltered",
    "nest.protection-recognised",
    "sunset.chair.seen",
    "sunset.mirror.seen",
    "sunset.truth.seen",
    "thorn-house.chair-carried",
    "thorn-house.space-cleared",
    "thorn-house.first-departure",
    "thorn-house.refilled",
    "thorn-house.frame-carried",
    "thorn-house.frame-rearranged",
    "thorn-house.second-departure",
    "thorn-house.pattern-returned",
    "thorn-house.fixing-ended",
    "thorn-house.key-recognised",
    "thorn-house.exit-crossed",
    "integration.swan-passage",
    "integration.wolf-boundary",
    "integration.seer-truth",
    "integration.three-capacities",
    "fire.false-promise.take",
    "fire.false-promise.flame",
    "fire.old-marker.take",
    "fire.old-marker.flame",
    "fire.empty-frame.take",
    "fire.empty-frame.flame",
    "fire.broken-key.take",
    "fire.broken-key.flame",
    "fire.dead-flower.take",
    "fire.dead-flower.flame",
    "fire.letter.take",
    "fire.letter.flame",
    "fire.true-memory.take",
    "fire.true-memory.flame",
    "fire.boundary-complete",
    "river.entered",
    "river.ash-washed",
    "river.birds-released",
    "river.surrender",
    "fork.past-entered",
    "fork.past-looped",
    "fork.weighed",
    "fork.token-carried",
    "fork.let-go",
    "fork.declined",
    "fork.departed",
    "fork.deleted",
    "fork.hope-relinquished",
    "lantern.owned",
    "climbs.ascent-seen",
    "mind.questions-examined",
    "mind.questions-left",
    "heart.rose.chosen",
    "heart.feather.chosen",
    "heart.reflection.chosen",
    "womb.linen.take",
    "womb.linen.created",
    "womb.light.take",
    "womb.light.created",
    "womb.page.take",
    "womb.page.created",
    "home.gate-recognises-keys",
    "home.continuity",
    "home.water.visited",
    "home.book.visited",
    "home.child-space.visited",
    "home.window.visited",
    "home.private-room-opened",
    "crown.recognised",
    "crown.integrated",
    "lantern.placed.mirror",
    "lantern.placed.reading-nook",
    "lantern.placed.fountain",
    "lantern.placed.window",
    "epilogue.reverse-light-started",
    "epilogue.reverse-light-complete",
    "epilogue.constellation-seen",
    "nest.unsupported-cycle.recover-protected-linen",
    "nest.unsupported-cycle.recover-responsibility",
    "nest.protection.recover-protected-linen",
    "nest.protection.recover-responsibility"
  ],
  "objectStates": {
    "broken-floor.reflection": [
      "clearing",
      "inverted",
      "revealed"
    ],
    "enchanted.guide": [
      "followed"
    ],
    "enchanted.rest": [
      "witnessed"
    ],
    "enchanted.hearth": [
      "leaning-away"
    ],
    "blue-moon.candle": [
      "lit"
    ],
    "blue-moon.water": [
      "rippled"
    ],
    "blue-moon.swan": [
      "followed"
    ],
    "blue-moon.roses": [
      "carried",
      "placed",
      "resting"
    ],
    "blue-moon.origami": [
      "awakened"
    ],
    "blue-moon.door": [
      "open"
    ],
    "blue-moon.cage-mirror": [
      "physical-cage",
      "reflected-cage"
    ],
    "nest.protected-linen": [
      "carried",
      "placed",
      "resting"
    ],
    "nest.responsibility": [
      "carried",
      "placed",
      "resting"
    ],
    "nest.day": [
      "compressed"
    ],
    "nest.key": [
      "recognised"
    ],
    "sunset.chair": [
      "absence"
    ],
    "sunset.mirror": [
      "route-visible"
    ],
    "sunset.truth": [
      "synchronised"
    ],
    "thorn-house.chair": [
      "carried",
      "placed",
      "reset",
      "resting"
    ],
    "thorn-house.table": [
      "refilled",
      "refilled-twice",
      "waiting",
      "waiting-again"
    ],
    "thorn-house.frame": [
      "carried",
      "left",
      "placed",
      "reset",
      "resting"
    ],
    "thorn-house.key": [
      "recognised"
    ],
    "thorn-house.exit": [
      "open"
    ],
    "integration.swan": [
      "passage"
    ],
    "integration.wolf": [
      "boundary"
    ],
    "integration.seer": [
      "aligned"
    ],
    "integration.meeting": [
      "aligned"
    ],
    "fire.false-promise": [
      "burned",
      "carried",
      "resting"
    ],
    "river.soot": [
      "loosening",
      "present",
      "washed"
    ],
    "fire.old-marker": [
      "burned",
      "carried",
      "resting"
    ],
    "fire.empty-frame": [
      "burned",
      "carried",
      "resting"
    ],
    "fire.broken-key": [
      "burned",
      "carried",
      "resting"
    ],
    "fire.dead-flower": [
      "burned",
      "carried",
      "resting"
    ],
    "fire.letter": [
      "burned",
      "carried",
      "resting"
    ],
    "fire.true-memory": [
      "carried",
      "preserved",
      "resting"
    ],
    "river.birds": [
      "released"
    ],
    "river.white-fabric": [
      "raised"
    ],
    "fork.past": [
      "entered",
      "looped"
    ],
    "fork.token": [
      "carried",
      "released",
      "resting"
    ],
    "fork.door": [
      "closed"
    ],
    "fork.mark": [
      "erased"
    ],
    "fork.hope": [
      "released"
    ],
    "lantern.master": [
      "carried",
      "placed"
    ],
    "climbs.horizon": [
      "visible"
    ],
    "mind.questions": [
      "behind",
      "dense"
    ],
    "heart.rose": [
      "carried"
    ],
    "heart.memory": [
      "blue-moon-reflection",
      "blush-rose",
      "swan-feather"
    ],
    "heart.feather": [
      "carried"
    ],
    "heart.reflection": [
      "carried"
    ],
    "womb.linen": [
      "carried",
      "created",
      "resting"
    ],
    "womb.creation": [
      "home",
      "rest",
      "voice"
    ],
    "womb.light": [
      "carried",
      "created",
      "resting"
    ],
    "womb.page": [
      "carried",
      "created",
      "resting"
    ],
    "home.gate": [
      "open"
    ],
    "home.continuity": [
      "present"
    ],
    "home.water": [
      "rippled"
    ],
    "home.book": [
      "open"
    ],
    "home.child-space": [
      "protected"
    ],
    "home.window": [
      "open"
    ],
    "home.private-room": [
      "open"
    ],
    "home.crown-mirror": [
      "integrated",
      "recognised"
    ],
    "lantern.final-placement": [
      "fountain",
      "mirror",
      "reading-nook",
      "window"
    ],
    "epilogue.reverse-light": [
      "complete",
      "running"
    ],
    "epilogue.constellation": [
      "witnessed"
    ]
  },
  "placements": {
    "blue-moon.roses": [
      "blue-moon.table"
    ],
    "nest.responsibility": [
      "nest.burden-rest"
    ],
    "nest.protected-linen": [
      "nest.safe-rest"
    ],
    "thorn-house.chair": [
      "thorn-house.cleared-space"
    ],
    "thorn-house.frame": [
      "thorn-house.shelf"
    ],
    "fire.false-promise": [
      "fire.flame"
    ],
    "fire.old-marker": [
      "fire.flame"
    ],
    "fire.empty-frame": [
      "fire.flame"
    ],
    "fire.broken-key": [
      "fire.flame"
    ],
    "fire.dead-flower": [
      "fire.flame"
    ],
    "fire.letter": [
      "fire.flame"
    ],
    "fire.true-memory": [
      "fire.flame"
    ],
    "womb.linen": [
      "womb.rest-space"
    ],
    "womb.light": [
      "womb.threshold"
    ],
    "womb.page": [
      "womb.writing-place"
    ],
    "lantern.master": [
      "fountain",
      "mirror",
      "reading-nook",
      "window"
    ]
  },
  "carryableIds": [
    "blue-moon.roses",
    "nest.protected-linen",
    "nest.responsibility",
    "thorn-house.chair",
    "thorn-house.frame",
    "fire.false-promise",
    "fire.old-marker",
    "fire.empty-frame",
    "fire.broken-key",
    "fire.dead-flower",
    "fire.letter",
    "fire.true-memory",
    "fork.token",
    "lantern.master",
    "heart.rose",
    "heart.feather",
    "heart.reflection",
    "womb.linen",
    "womb.light",
    "womb.page"
  ],
  "keepsakeIds": [
    "lantern.master",
    "heart.rose",
    "heart.feather",
    "heart.reflection"
  ]
} as const;

type PersistentEventEvidence = { completedStoryEventIds: string[]; storyObjectStates: Record<string, string>; storyPlacementStates: Record<string, string> };
/** Shared by browser storage and Cloudflare; private/free text is never admitted. */
export function sanitizeStoryEventPersistence(input: unknown): PersistentEventEvidence {
  const value = input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : {};
  const eventIds = new Set<string>(STORY_EVENT_SCHEMA.eventIds);
  const completedStoryEventIds = Array.isArray(value.completedStoryEventIds)
    ? Array.from(new Set(value.completedStoryEventIds.filter((id): id is string => typeof id === "string" && eventIds.has(id)))).slice(0, eventIds.size)
    : [];
  const readRecord = (source: unknown, allowed: Record<string, readonly string[]>) => {
    if (!source || typeof source !== "object" || Array.isArray(source)) return {};
    return Object.fromEntries(Object.entries(source).filter(([id, state]) =>
      Object.prototype.hasOwnProperty.call(allowed, id) && typeof state === "string" && allowed[id].includes(state)));
  };
  const storyObjectStates = readRecord(value.storyObjectStates, STORY_EVENT_SCHEMA.objectStates) as Record<string, string>;
  const storyPlacementStates = readRecord(value.storyPlacementStates, STORY_EVENT_SCHEMA.placements) as Record<string, string>;
  const capacity = typeof value.sceneId === "string" && value.sceneId.startsWith("nest.") ? 2 : 1;
  const keepsakes = new Set<string>(STORY_EVENT_SCHEMA.keepsakeIds);
  let carried = 0;
  for (const id of STORY_EVENT_SCHEMA.carryableIds) {
    if (storyObjectStates[id] !== "carried" || keepsakes.has(id)) continue;
    if (++carried > capacity) storyObjectStates[id] = "resting";
  }
  return { completedStoryEventIds, storyObjectStates, storyPlacementStates };
}
