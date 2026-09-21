import type { StoryEventDefinition, StoryObjectDefinition } from "./storyEventTypes.ts";

/** Explicit authored interactions; never derived from prose keywords. */
export const STORY_OBJECTS = [
  {
    "id": "broken-floor.reflection",
    "label": "Wet floor",
    "kind": "water",
    "sceneIds": [
      "broken-floor.confession"
    ],
    "localPosition": [
      0,
      0.04,
      2.2
    ],
    "radius": 2.2,
    "verbs": [
      "wipe",
      "touch"
    ]
  },
  {
    "id": "enchanted.guide",
    "label": "Distant lantern",
    "kind": "lantern",
    "sceneIds": [
      "enchanted.rabbit-hole"
    ],
    "localPosition": [
      0,
      1.3,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "enchanted.rest",
    "label": "Meadow seat",
    "kind": "chair",
    "sceneIds": [
      "enchanted.friendship-meadow"
    ],
    "localPosition": [
      -1,
      0.4,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "enchanted.hearth",
    "label": "Quiet hearth",
    "kind": "fire",
    "sceneIds": [
      "enchanted.masked-hearth"
    ],
    "localPosition": [
      0,
      0.4,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "gaze"
    ]
  },
  {
    "id": "blue-moon.candle",
    "label": "First candle",
    "kind": "candle",
    "sceneIds": [
      "blue-moon.sanctuary"
    ],
    "localPosition": [
      -3,
      0.7,
      -1.5
    ],
    "radius": 2.2,
    "verbs": [
      "light"
    ]
  },
  {
    "id": "blue-moon.water",
    "label": "Moonlit water",
    "kind": "water",
    "sceneIds": [
      "blue-moon.sanctuary"
    ],
    "localPosition": [
      3.3,
      0.05,
      1.8
    ],
    "radius": 2.2,
    "verbs": [
      "touch"
    ]
  },
  {
    "id": "blue-moon.swan",
    "label": "Swan",
    "kind": "swan",
    "sceneIds": [
      "blue-moon.intimacy"
    ],
    "localPosition": [
      -3,
      0.2,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "blue-moon.roses",
    "label": "Blush roses",
    "kind": "rose",
    "sceneIds": [
      "blue-moon.intimacy"
    ],
    "localPosition": [
      -1,
      0.7,
      1
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "blue-moon.table",
        "label": "Flower table",
        "localPosition": [
          3,
          0.8,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "blue-moon.origami",
    "label": "Paper Swan",
    "kind": "origami",
    "sceneIds": [
      "blue-moon.intimacy"
    ],
    "localPosition": [
      2,
      1.2,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "touch"
    ]
  },
  {
    "id": "blue-moon.door",
    "label": "Pale door",
    "kind": "door",
    "sceneIds": [
      "blue-moon.intimacy"
    ],
    "localPosition": [
      0,
      1.1,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "open"
    ]
  },
  {
    "id": "blue-moon.cage-mirror",
    "label": "Water mirror",
    "kind": "mirror",
    "sceneIds": [
      "blue-moon.caged-bird"
    ],
    "localPosition": [
      1,
      1.3,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "gaze",
      "touch"
    ]
  },
  {
    "id": "nest.protected-linen",
    "label": "Protected linen",
    "kind": "fabric",
    "sceneIds": [
      "nest.two-hands",
      "nest.unsupported-cycle",
      "nest.protection"
    ],
    "localPosition": [
      -1,
      0.6,
      1.5
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "nest.safe-rest",
        "label": "Protected resting place",
        "localPosition": [
          -1,
          0.6,
          3.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "nest.responsibility",
    "label": "Responsibility basket",
    "kind": "basket",
    "sceneIds": [
      "nest.two-hands",
      "nest.unsupported-cycle",
      "nest.protection"
    ],
    "localPosition": [
      1,
      0.7,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "nest.burden-rest",
        "label": "Safe surface",
        "localPosition": [
          2,
          0.65,
          3.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "nest.day",
    "label": "Sunlit window",
    "kind": "frame",
    "sceneIds": [
      "nest.unsupported-cycle"
    ],
    "localPosition": [
      0,
      1.5,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "gaze"
    ]
  },
  {
    "id": "nest.key",
    "label": "Protection key",
    "kind": "key",
    "sceneIds": [
      "nest.protection"
    ],
    "localPosition": [
      0,
      0.8,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "touch"
    ]
  },
  {
    "id": "sunset.chair",
    "label": "Empty reflected chair",
    "kind": "mirror",
    "sceneIds": [
      "sunset.warning-grove"
    ],
    "localPosition": [
      0,
      1.1,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "gaze"
    ]
  },
  {
    "id": "sunset.mirror",
    "label": "High mirror",
    "kind": "mirror",
    "sceneIds": [
      "sunset.true-mirror"
    ],
    "localPosition": [
      0,
      1.1,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "gaze"
    ]
  },
  {
    "id": "sunset.truth",
    "label": "Still water",
    "kind": "mirror",
    "sceneIds": [
      "sunset.stillness"
    ],
    "localPosition": [
      0,
      1.1,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "thorn-house.chair",
    "label": "House chair",
    "kind": "chair",
    "sceneIds": [
      "thorned.locked-garden"
    ],
    "localPosition": [
      -2,
      0.5,
      1.5
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "thorn-house.cleared-space",
        "label": "Cleared place",
        "localPosition": [
          2,
          0.5,
          2.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "thorn-house.threshold",
    "label": "House threshold",
    "kind": "door",
    "sceneIds": [
      "thorned.locked-garden",
      "thorned.old-memory-bedroom"
    ],
    "localPosition": [
      0,
      1,
      -4
    ],
    "radius": 2.2,
    "verbs": [
      "volume-exit",
      "volume-enter"
    ]
  },
  {
    "id": "thorn-house.frame",
    "label": "Old frame",
    "kind": "frame",
    "sceneIds": [
      "thorned.old-memory-bedroom"
    ],
    "localPosition": [
      -1,
      1.1,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "thorn-house.shelf",
        "label": "Another shelf",
        "localPosition": [
          2,
          1.1,
          3
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "thorn-house.key",
    "label": "Own key",
    "kind": "key",
    "sceneIds": [
      "thorned.self-owned-world"
    ],
    "localPosition": [
      -1,
      0.8,
      1
    ],
    "radius": 2.2,
    "verbs": [
      "touch"
    ]
  },
  {
    "id": "thorn-house.exit",
    "label": "Open exit",
    "kind": "door",
    "sceneIds": [
      "thorned.self-owned-world"
    ],
    "localPosition": [
      0,
      1,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "integration.swan",
    "label": "Swan water passage",
    "kind": "swan",
    "sceneIds": [
      "wolf-swan.false-choice"
    ],
    "localPosition": [
      4,
      0.25,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "integration.wolf",
    "label": "Wolf boundary",
    "kind": "wolf",
    "sceneIds": [
      "wolf-swan.false-choice"
    ],
    "localPosition": [
      -4,
      0.3,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "integration.seer",
    "label": "Seer mirror",
    "kind": "mirror",
    "sceneIds": [
      "wolf-swan.false-choice"
    ],
    "localPosition": [
      0,
      1.3,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "integration.meeting",
    "label": "Meeting ring",
    "kind": "water",
    "sceneIds": [
      "wolf-swan.convergence"
    ],
    "localPosition": [
      0,
      0.08,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "fire.false-promise",
    "label": "Promise remnant",
    "kind": "letter",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      -3,
      0.5,
      0
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.old-marker",
    "label": "Obsolete path marker",
    "kind": "marker",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      3,
      0.5,
      0
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.empty-frame",
    "label": "Empty frame",
    "kind": "frame",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      -3,
      0.6,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.broken-key",
    "label": "Broken copy of a key",
    "kind": "key",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      3,
      0.6,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.dead-flower",
    "label": "Dead flower",
    "kind": "rose",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      -3,
      0.5,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.letter",
    "label": "Letter remnant",
    "kind": "letter",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      3,
      0.5,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.true-memory",
    "label": "Blush rose memory",
    "kind": "rose",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      0,
      0.7,
      -1
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "burn"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fire.flame",
        "label": "Contained fire",
        "localPosition": [
          0,
          0.25,
          4
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fire.flame",
    "label": "Contained fire",
    "kind": "fire",
    "sceneIds": [
      "fire.boundary"
    ],
    "localPosition": [
      0,
      0.25,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "river.water",
    "label": "Moving river",
    "kind": "water",
    "sceneIds": [
      "river.wash"
    ],
    "localPosition": [
      0,
      0.05,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter",
      "wash"
    ]
  },
  {
    "id": "river.birds",
    "label": "Gathered black birds",
    "kind": "birds",
    "sceneIds": [
      "river.release-surrender"
    ],
    "localPosition": [
      0,
      3.5,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "release"
    ]
  },
  {
    "id": "river.white-fabric",
    "label": "White fabric",
    "kind": "fabric",
    "sceneIds": [
      "river.release-surrender"
    ],
    "localPosition": [
      1,
      0.8,
      4
    ],
    // Natural stillness belongs to the quiet clearing around the fabric.
    "radius": 14,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "fork.past",
    "label": "Familiar path",
    "kind": "path",
    "sceneIds": [
      "fork.weighing"
    ],
    "localPosition": [
      -4,
      0.1,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter",
      "volume-exit"
    ]
  },
  {
    "id": "fork.weighing-stone",
    "label": "Weighing stone",
    "kind": "chair",
    "sceneIds": [
      "fork.weighing"
    ],
    "localPosition": [
      0,
      0.4,
      -1
    ],
    "radius": 2.2,
    "verbs": [
      "stillness"
    ]
  },
  {
    "id": "fork.token",
    "label": "Old token",
    "kind": "key",
    "sceneIds": [
      "fork.four-verbs"
    ],
    "localPosition": [
      -3,
      0.6,
      -1
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "release"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "fork.current",
        "label": "Moving water",
        "localPosition": [
          -4,
          0.1,
          3
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "fork.door",
    "label": "Familiar door",
    "kind": "door",
    "sceneIds": [
      "fork.four-verbs"
    ],
    "localPosition": [
      4,
      1,
      -2
    ],
    "radius": 2.2,
    "verbs": [
      "close",
      "volume-exit"
    ]
  },
  {
    "id": "fork.mark",
    "label": "Obsolete path mark",
    "kind": "marker",
    "sceneIds": [
      "fork.four-verbs"
    ],
    "localPosition": [
      3,
      0.4,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "wipe"
    ]
  },
  {
    "id": "fork.hope",
    "label": "Old hope blooms",
    "kind": "rose",
    "sceneIds": [
      "fork.relinquish-hope"
    ],
    "localPosition": [
      -1,
      0.7,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "release"
    ]
  },
  {
    "id": "lantern.master",
    "label": "Master Lantern",
    "kind": "lantern",
    "sceneIds": [
      "fork.relinquish-hope",
      "crowned.sovereignty"
    ],
    "localPosition": [
      1,
      1,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "keepsake": true,
    "targets": [
      {
        "id": "mirror",
        "label": "Near the mirror",
        "localPosition": [
          -3,
          0.9,
          3
        ],
        "radius": 2.3
      },
      {
        "id": "reading-nook",
        "label": "Reading nook",
        "localPosition": [
          3,
          0.7,
          2
        ],
        "radius": 2.3
      },
      {
        "id": "fountain",
        "label": "Fountain",
        "localPosition": [
          0,
          0.55,
          5
        ],
        "radius": 2.3
      },
      {
        "id": "window",
        "label": "Window terrace",
        "localPosition": [
          4,
          0.85,
          5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "climbs.horizon",
    "label": "Open ascent",
    "kind": "path",
    "sceneIds": [
      "climbs.arrival"
    ],
    "localPosition": [
      0,
      0.15,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "mind.questions",
    "label": "Questions",
    "kind": "page",
    "sceneIds": [
      "climb.mind"
    ],
    "localPosition": [
      -2,
      1.3,
      1
    ],
    "radius": 2.2,
    "verbs": [
      "gaze"
    ]
  },
  {
    "id": "mind.onward",
    "label": "Onward path",
    "kind": "path",
    "sceneIds": [
      "climb.mind"
    ],
    "localPosition": [
      0,
      0.2,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "heart.rose",
    "label": "Blush rose",
    "kind": "rose",
    "sceneIds": [
      "climb.heart"
    ],
    "localPosition": [
      -2.4,
      0.8,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "pickup"
    ],
    "carryable": true,
    "keepsake": true
  },
  {
    "id": "heart.feather",
    "label": "Swan feather",
    "kind": "feather",
    "sceneIds": [
      "climb.heart"
    ],
    "localPosition": [
      0.0,
      0.8,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "pickup"
    ],
    "carryable": true,
    "keepsake": true
  },
  {
    "id": "heart.reflection",
    "label": "Blue Moon reflection",
    "kind": "mirror",
    "sceneIds": [
      "climb.heart"
    ],
    "localPosition": [
      2.4,
      0.8,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "pickup"
    ],
    "carryable": true,
    "keepsake": true
  },
  {
    "id": "womb.linen",
    "label": "Folded linen",
    "kind": "fabric",
    "sceneIds": [
      "climb.womb"
    ],
    "localPosition": [
      -2.4,
      0.6,
      1.5
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "womb.rest-space",
        "label": "Protected rest-space",
        "localPosition": [
          -2.4,
          0.65,
          4.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "womb.light",
    "label": "Unlit home light",
    "kind": "candle",
    "sceneIds": [
      "climb.womb"
    ],
    "localPosition": [
      0.0,
      0.6,
      1.5
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "womb.threshold",
        "label": "Empty threshold",
        "localPosition": [
          0.0,
          0.65,
          4.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "womb.page",
    "label": "Unwritten page",
    "kind": "page",
    "sceneIds": [
      "climb.womb"
    ],
    "localPosition": [
      2.4,
      0.6,
      1.5
    ],
    "radius": 2.2,
    "verbs": [
      "pickup",
      "place"
    ],
    "carryable": true,
    "targets": [
      {
        "id": "womb.writing-place",
        "label": "Writing place",
        "localPosition": [
          2.4,
          0.65,
          4.5
        ],
        "radius": 2.3
      }
    ]
  },
  {
    "id": "home.gate",
    "label": "Home gate",
    "kind": "door",
    "sceneIds": [
      "crowned.threshold"
    ],
    "localPosition": [
      0,
      1,
      3
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "home.water",
    "label": "Living fountain",
    "kind": "water",
    "sceneIds": [
      "crowned.home"
    ],
    "localPosition": [
      -2,
      0.35,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "touch"
    ]
  },
  {
    "id": "home.book",
    "label": "Open book",
    "kind": "book",
    "sceneIds": [
      "crowned.home"
    ],
    "localPosition": [
      2,
      0.8,
      2
    ],
    "radius": 2.2,
    "verbs": [
      "open"
    ]
  },
  {
    "id": "home.child-space",
    "label": "Protected child-space",
    "kind": "nest",
    "sceneIds": [
      "crowned.home"
    ],
    "localPosition": [
      -3,
      0.7,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "inspect"
    ]
  },
  {
    "id": "home.window",
    "label": "Window curtain",
    "kind": "fabric",
    "sceneIds": [
      "crowned.home"
    ],
    "localPosition": [
      3,
      1.3,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "open"
    ]
  },
  {
    "id": "home.private-room",
    "label": "Private room",
    "kind": "door",
    "sceneIds": [
      "crowned.home"
    ],
    "localPosition": [
      0,
      1,
      5
    ],
    "radius": 2.2,
    "verbs": [
      "volume-enter"
    ]
  },
  {
    "id": "home.crown-mirror",
    "label": "Crown reflection",
    "kind": "mirror",
    "sceneIds": [
      "crowned.sovereignty"
    ],
    "localPosition": [
      0,
      1.6,
      4
    ],
    "radius": 2.2,
    "verbs": [
      "gaze",
      "touch"
    ]
  }
] as const satisfies readonly StoryObjectDefinition[];

export const CHAPTER_STORY_EVENTS = [
  {
    "id": "epilogue.constellation.enter",
    "sceneId": "epilogue.constellation",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "epilogue.constellation"
      }
    ],
    "optional": true
  },
  {
    "id": "crowned.sovereignty.enter",
    "sceneId": "crowned.sovereignty",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "crowned.sovereignty"
      }
    ],
    "optional": true
  },
  {
    "id": "crowned.home.enter",
    "sceneId": "crowned.home",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "crowned.home"
      }
    ],
    "optional": true
  },
  {
    "id": "crowned.threshold.enter",
    "sceneId": "crowned.threshold",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "crowned.threshold"
      }
    ],
    "optional": true
  },
  {
    "id": "climb.womb.enter",
    "sceneId": "climb.womb",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "climb.womb"
      }
    ],
    "optional": true
  },
  {
    "id": "climb.heart.enter",
    "sceneId": "climb.heart",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "climb.heart"
      }
    ],
    "optional": true
  },
  {
    "id": "climb.mind.enter",
    "sceneId": "climb.mind",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "climb.mind"
      }
    ],
    "optional": true
  },
  {
    "id": "climbs.arrival.enter",
    "sceneId": "climbs.arrival",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "climbs.arrival"
      }
    ],
    "optional": true
  },
  {
    "id": "fork.relinquish-hope.enter",
    "sceneId": "fork.relinquish-hope",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "fork.relinquish-hope"
      }
    ],
    "optional": true
  },
  {
    "id": "fork.four-verbs.enter",
    "sceneId": "fork.four-verbs",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "fork.four-verbs"
      }
    ],
    "optional": true
  },
  {
    "id": "fork.weighing.enter",
    "sceneId": "fork.weighing",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "fork.weighing"
      }
    ],
    "optional": true
  },
  {
    "id": "river.release-surrender.enter",
    "sceneId": "river.release-surrender",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "river.release-surrender"
      }
    ],
    "optional": true
  },
  {
    "id": "river.wash.enter",
    "sceneId": "river.wash",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "river.wash"
      }
    ],
    "optional": true
  },
  {
    "id": "fire.boundary.enter",
    "sceneId": "fire.boundary",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "fire.boundary"
      }
    ],
    "optional": true
  },
  {
    "id": "wolf-swan.convergence.enter",
    "sceneId": "wolf-swan.convergence",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "wolf-swan.convergence"
      }
    ],
    "optional": true
  },
  {
    "id": "wolf-swan.false-choice.enter",
    "sceneId": "wolf-swan.false-choice",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "wolf-swan.false-choice"
      }
    ],
    "optional": true
  },
  {
    "id": "thorned.self-owned-world.enter",
    "sceneId": "thorned.self-owned-world",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "thorned.self-owned-world"
      }
    ],
    "optional": true
  },
  {
    "id": "thorned.old-memory-bedroom.enter",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "thorned.old-memory-bedroom"
      }
    ],
    "optional": true
  },
  {
    "id": "thorned.locked-garden.enter",
    "sceneId": "thorned.locked-garden",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "thorned.locked-garden"
      }
    ],
    "optional": true
  },
  {
    "id": "sunset.stillness.enter",
    "sceneId": "sunset.stillness",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "sunset.stillness"
      }
    ],
    "optional": true
  },
  {
    "id": "sunset.true-mirror.enter",
    "sceneId": "sunset.true-mirror",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "sunset.true-mirror"
      }
    ],
    "optional": true
  },
  {
    "id": "sunset.warning-grove.enter",
    "sceneId": "sunset.warning-grove",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "sunset.warning-grove"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.protection.enter",
    "sceneId": "nest.protection",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "nest.protection"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.unsupported-cycle.enter",
    "sceneId": "nest.unsupported-cycle",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "nest.unsupported-cycle"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.two-hands.enter",
    "sceneId": "nest.two-hands",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "nest.two-hands"
      }
    ],
    "optional": true
  },
  {
    "id": "blue-moon.caged-bird.enter",
    "sceneId": "blue-moon.caged-bird",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "blue-moon.caged-bird"
      }
    ],
    "optional": true
  },
  {
    "id": "blue-moon.intimacy.enter",
    "sceneId": "blue-moon.intimacy",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "blue-moon.intimacy"
      }
    ],
    "optional": true
  },
  {
    "id": "blue-moon.sanctuary.enter",
    "sceneId": "blue-moon.sanctuary",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "blue-moon.sanctuary"
      }
    ],
    "optional": true
  },
  {
    "id": "enchanted.masked-hearth.enter",
    "sceneId": "enchanted.masked-hearth",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "enchanted.masked-hearth"
      }
    ],
    "optional": true
  },
  {
    "id": "enchanted.friendship-meadow.enter",
    "sceneId": "enchanted.friendship-meadow",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "enchanted.friendship-meadow"
      }
    ],
    "optional": true
  },
  {
    "id": "enchanted.rabbit-hole.enter",
    "sceneId": "enchanted.rabbit-hole",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "enchanted.rabbit-hole"
      }
    ],
    "optional": true
  },
  {
    "id": "broken-floor.confession.enter",
    "sceneId": "broken-floor.confession",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "story-events.started"
      },
      {
        "type": "environment",
        "cue": "broken-floor.confession"
      }
    ],
    "optional": true
  },
  {
    "id": "broken-floor.first-wipe",
    "sceneId": "broken-floor.confession",
    "trigger": "wipe",
    "objectId": "broken-floor.reflection",
    "actions": [
      {
        "type": "object-state",
        "objectId": "broken-floor.reflection",
        "state": "clearing"
      },
      {
        "type": "sound",
        "cue": "cloth-water"
      }
    ]
  },
  {
    "id": "broken-floor.forest-revealed",
    "sceneId": "broken-floor.confession",
    "trigger": "wipe",
    "objectId": "broken-floor.reflection",
    "requires": [
      {
        "type": "event",
        "id": "broken-floor.first-wipe"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "broken-floor.reflection",
        "state": "revealed"
      },
      {
        "type": "environment",
        "cue": "branches-beneath-floor"
      }
    ]
  },
  {
    "id": "broken-floor.inversion",
    "sceneId": "broken-floor.confession",
    "trigger": "touch",
    "objectId": "broken-floor.reflection",
    "requires": [
      {
        "type": "event",
        "id": "broken-floor.forest-revealed"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "broken-floor.reflection",
        "state": "inverted"
      },
      {
        "type": "environment",
        "cue": "room-becomes-reflection"
      },
      {
        "type": "camera",
        "cue": "rise-from-floor"
      },
      {
        "type": "prose",
        "cue": "fragment-001"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.accept-lantern"
      },
      {
        "type": "world-flag",
        "flagId": "path.first-wood-readable"
      },
      {
        "type": "world-flag",
        "flagId": "guidance.fireflies-awake"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.first-wood-lantern",
        "state": "awakened"
      },
      {
        "type": "resonance",
        "key": "seer",
        "amount": 6
      }
    ]
  },
  {
    "id": "enchanted.follow-light",
    "sceneId": "enchanted.rabbit-hole",
    "trigger": "volume-enter",
    "objectId": "enchanted.guide",
    "actions": [
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "lead"
      },
      {
        "type": "actor",
        "actor": "wolf",
        "cue": "cross-path"
      },
      {
        "type": "object-state",
        "objectId": "enchanted.guide",
        "state": "followed"
      },
      {
        "type": "environment",
        "cue": "flowers-answer"
      }
    ]
  },
  {
    "id": "enchanted.meadow-warmth",
    "sceneId": "enchanted.friendship-meadow",
    "trigger": "stillness",
    "objectId": "enchanted.rest",
    "durationMs": 2600,
    "actions": [
      {
        "type": "object-state",
        "objectId": "enchanted.rest",
        "state": "witnessed"
      },
      {
        "type": "actor",
        "actor": "swan",
        "cue": "rest"
      },
      {
        "type": "lighting",
        "cue": "meadow-warms"
      }
    ]
  },
  {
    "id": "enchanted.hearth-unease",
    "sceneId": "enchanted.masked-hearth",
    "trigger": "gaze",
    "objectId": "enchanted.hearth",
    "durationMs": 1800,
    "actions": [
      {
        "type": "object-state",
        "objectId": "enchanted.hearth",
        "state": "leaning-away"
      },
      {
        "type": "actor",
        "actor": "wolf",
        "cue": "watch"
      },
      {
        "type": "lighting",
        "cue": "fire-leans-away"
      }
    ]
  },
  {
    "id": "blue-moon.candle-chain",
    "sceneId": "blue-moon.sanctuary",
    "trigger": "light",
    "objectId": "blue-moon.candle",
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.candle",
        "state": "lit"
      },
      {
        "type": "world-flag",
        "flagId": "blue-moon.candles-lit"
      },
      {
        "type": "lighting",
        "cue": "candle-propagation"
      }
    ]
  },
  {
    "id": "blue-moon.water-reveal",
    "sceneId": "blue-moon.sanctuary",
    "trigger": "touch",
    "objectId": "blue-moon.water",
    "requires": [
      {
        "type": "event",
        "id": "blue-moon.candle-chain"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.water",
        "state": "rippled"
      },
      {
        "type": "world-flag",
        "flagId": "blue-moon.water-touched"
      },
      {
        "type": "prose",
        "cue": "fragment-062"
      },
      {
        "type": "sound",
        "cue": "water-close"
      }
    ]
  },
  {
    "id": "blue-moon.swan-followed",
    "sceneId": "blue-moon.intimacy",
    "trigger": "volume-enter",
    "objectId": "blue-moon.swan",
    "actions": [
      {
        "type": "actor",
        "actor": "swan",
        "cue": "lead"
      },
      {
        "type": "object-state",
        "objectId": "blue-moon.swan",
        "state": "followed"
      },
      {
        "type": "world-flag",
        "flagId": "blue-moon.swan-followed"
      }
    ]
  },
  {
    "id": "blue-moon.roses-carried",
    "sceneId": "blue-moon.intimacy",
    "trigger": "pickup",
    "objectId": "blue-moon.roses",
    "requires": [
      {
        "type": "event",
        "id": "blue-moon.swan-followed"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.roses",
        "state": "carried"
      }
    ]
  },
  {
    "id": "blue-moon.roses-placed",
    "sceneId": "blue-moon.intimacy",
    "trigger": "place",
    "objectId": "blue-moon.roses",
    "targetId": "blue-moon.table",
    "requires": [
      {
        "type": "object",
        "id": "blue-moon.roses",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.roses",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "blue-moon.roses",
        "targetId": "blue-moon.table"
      },
      {
        "type": "world-flag",
        "flagId": "blue-moon.flowers-placed"
      }
    ]
  },
  {
    "id": "blue-moon.origami-awakened",
    "sceneId": "blue-moon.intimacy",
    "trigger": "touch",
    "objectId": "blue-moon.origami",
    "requires": [
      {
        "type": "event",
        "id": "blue-moon.roses-placed"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.origami",
        "state": "awakened"
      },
      {
        "type": "environment",
        "cue": "origami-awakening"
      }
    ]
  },
  {
    "id": "blue-moon.door-opened",
    "sceneId": "blue-moon.intimacy",
    "trigger": "open",
    "objectId": "blue-moon.door",
    "requires": [
      {
        "type": "event",
        "id": "blue-moon.origami-awakened"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.door",
        "state": "open"
      },
      {
        "type": "world-flag",
        "flagId": "blue-moon.beautiful-door-open"
      },
      {
        "type": "environment",
        "cue": "reflection-delay"
      },
      {
        "type": "silence",
        "cue": "missing-note"
      }
    ]
  },
  {
    "id": "blue-moon.cage-reflected",
    "sceneId": "blue-moon.caged-bird",
    "trigger": "gaze",
    "objectId": "blue-moon.cage-mirror",
    "durationMs": 1600,
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.cage-mirror",
        "state": "reflected-cage"
      },
      {
        "type": "environment",
        "cue": "cage-only-in-reflection"
      }
    ]
  },
  {
    "id": "blue-moon.cage-recognised",
    "sceneId": "blue-moon.caged-bird",
    "trigger": "touch",
    "objectId": "blue-moon.cage-mirror",
    "requires": [
      {
        "type": "event",
        "id": "blue-moon.cage-reflected"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "blue-moon.cage-mirror",
        "state": "physical-cage"
      },
      {
        "type": "environment",
        "cue": "cage-becomes-physical"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.accept-memory"
      },
      {
        "type": "symbol",
        "objectId": "memory.blue-moon"
      },
      {
        "type": "world-flag",
        "flagId": "archive.memory-carried"
      },
      {
        "type": "world-flag",
        "flagId": "archive.nostalgia-loops-closed"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.blue-moon-archive",
        "state": "witnessed"
      },
      {
        "type": "resonance",
        "key": "swan",
        "amount": 12
      }
    ]
  },
  {
    "id": "nest.first-hand",
    "sceneId": "nest.two-hands",
    "trigger": "pickup",
    "objectId": "nest.protected-linen",
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.protected-linen",
        "state": "carried"
      },
      {
        "type": "world-flag",
        "flagId": "nest.hand-held"
      }
    ]
  },
  {
    "id": "nest.second-hand",
    "sceneId": "nest.two-hands",
    "trigger": "pickup",
    "objectId": "nest.responsibility",
    "requires": [
      {
        "type": "event",
        "id": "nest.first-hand"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.responsibility",
        "state": "carried"
      },
      {
        "type": "world-flag",
        "flagId": "nest.hand-kept"
      }
    ]
  },
  {
    "id": "nest.days-compress",
    "sceneId": "nest.unsupported-cycle",
    "trigger": "gaze",
    "objectId": "nest.day",
    "durationMs": 5500,
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.day",
        "state": "compressed"
      },
      {
        "type": "world-flag",
        "flagId": "nest.unsupported-burden-held"
      },
      {
        "type": "environment",
        "cue": "compressed-day-cycles"
      }
    ]
  },
  {
    "id": "nest.burden-set-down",
    "sceneId": "nest.unsupported-cycle",
    "trigger": "place",
    "objectId": "nest.responsibility",
    "targetId": "nest.burden-rest",
    "requires": [
      {
        "type": "event",
        "id": "nest.days-compress"
      },
      {
        "type": "object",
        "id": "nest.responsibility",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.responsibility",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "nest.responsibility",
        "targetId": "nest.burden-rest"
      },
      {
        "type": "world-flag",
        "flagId": "nest.unsupported-burden-released"
      },
      {
        "type": "silence",
        "cue": "relief-without-abandonment"
      }
    ]
  },
  {
    "id": "nest.linen-sheltered",
    "sceneId": "nest.protection",
    "trigger": "place",
    "objectId": "nest.protected-linen",
    "targetId": "nest.safe-rest",
    "requires": [
      {
        "type": "object",
        "id": "nest.protected-linen",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.protected-linen",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "nest.protected-linen",
        "targetId": "nest.safe-rest"
      }
    ]
  },
  {
    "id": "nest.protection-recognised",
    "sceneId": "nest.protection",
    "trigger": "touch",
    "objectId": "nest.key",
    "requires": [
      {
        "type": "event",
        "id": "nest.linen-sheltered"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.key",
        "state": "recognised"
      },
      {
        "type": "key",
        "keyId": "key.protection"
      },
      {
        "type": "world-flag",
        "flagId": "nest.protection-acknowledged"
      }
    ]
  },
  {
    "id": "sunset.chair.seen",
    "sceneId": "sunset.warning-grove",
    "trigger": "gaze",
    "objectId": "sunset.chair",
    "durationMs": 1800,
    "actions": [
      {
        "type": "object-state",
        "objectId": "sunset.chair",
        "state": "absence"
      },
      {
        "type": "actor",
        "actor": "seer",
        "cue": "reveal"
      },
      {
        "type": "environment",
        "cue": "absence"
      }
    ]
  },
  {
    "id": "sunset.mirror.seen",
    "sceneId": "sunset.true-mirror",
    "trigger": "gaze",
    "objectId": "sunset.mirror",
    "durationMs": 2200,
    "actions": [
      {
        "type": "object-state",
        "objectId": "sunset.mirror",
        "state": "route-visible"
      },
      {
        "type": "actor",
        "actor": "seer",
        "cue": "reveal"
      },
      {
        "type": "environment",
        "cue": "route-visible"
      }
    ]
  },
  {
    "id": "sunset.truth.seen",
    "sceneId": "sunset.stillness",
    "trigger": "stillness",
    "objectId": "sunset.truth",
    "durationMs": 6200,
    "actions": [
      {
        "type": "object-state",
        "objectId": "sunset.truth",
        "state": "synchronised"
      },
      {
        "type": "actor",
        "actor": "seer",
        "cue": "reveal"
      },
      {
        "type": "environment",
        "cue": "synchronised"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.witness-mirror"
      },
      {
        "type": "world-flag",
        "flagId": "mirror.reflections-truthful"
      },
      {
        "type": "world-flag",
        "flagId": "path.reflected-route-visible"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.mirror",
        "state": "scarred"
      },
      {
        "type": "resonance",
        "key": "seer",
        "amount": 12
      }
    ]
  },
  {
    "id": "thorn-house.chair-carried",
    "sceneId": "thorned.locked-garden",
    "trigger": "pickup",
    "objectId": "thorn-house.chair",
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.chair",
        "state": "carried"
      }
    ]
  },
  {
    "id": "thorn-house.space-cleared",
    "sceneId": "thorned.locked-garden",
    "trigger": "place",
    "objectId": "thorn-house.chair",
    "targetId": "thorn-house.cleared-space",
    "requires": [
      {
        "type": "object",
        "id": "thorn-house.chair",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.chair",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "thorn-house.chair",
        "targetId": "thorn-house.cleared-space"
      },
      {
        "type": "world-flag",
        "flagId": "thorn-house.space-cleared"
      }
    ]
  },
  {
    "id": "thorn-house.first-departure",
    "sceneId": "thorned.locked-garden",
    "trigger": "volume-exit",
    "objectId": "thorn-house.threshold",
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.space-cleared"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.table",
        "state": "waiting"
      }
    ]
  },
  {
    "id": "thorn-house.refilled",
    "sceneId": "thorned.locked-garden",
    "trigger": "volume-enter",
    "objectId": "thorn-house.threshold",
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.first-departure"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.table",
        "state": "refilled"
      },
      {
        "type": "object-state",
        "objectId": "thorn-house.chair",
        "state": "reset"
      },
      {
        "type": "world-flag",
        "flagId": "thorn-house.space-refilled"
      },
      {
        "type": "environment",
        "cue": "house-refills"
      }
    ]
  },
  {
    "id": "thorn-house.frame-carried",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "pickup",
    "objectId": "thorn-house.frame",
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.frame",
        "state": "carried"
      }
    ]
  },
  {
    "id": "thorn-house.frame-rearranged",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "place",
    "objectId": "thorn-house.frame",
    "targetId": "thorn-house.shelf",
    "requires": [
      {
        "type": "object",
        "id": "thorn-house.frame",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.frame",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "thorn-house.frame",
        "targetId": "thorn-house.shelf"
      }
    ]
  },
  {
    "id": "thorn-house.second-departure",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "volume-exit",
    "objectId": "thorn-house.threshold",
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.frame-rearranged"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.table",
        "state": "waiting-again"
      }
    ]
  },
  {
    "id": "thorn-house.pattern-returned",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "volume-enter",
    "objectId": "thorn-house.threshold",
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.second-departure"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.frame",
        "state": "reset"
      },
      {
        "type": "object-state",
        "objectId": "thorn-house.table",
        "state": "refilled-twice"
      },
      {
        "type": "environment",
        "cue": "architecture-compresses"
      }
    ]
  },
  {
    "id": "thorn-house.fixing-ended",
    "sceneId": "thorned.old-memory-bedroom",
    "trigger": "stillness",
    "objectId": "thorn-house.frame",
    "durationMs": 2400,
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.pattern-returned"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.frame",
        "state": "left"
      },
      {
        "type": "world-flag",
        "flagId": "thorn-house.reorganisation-released"
      },
      {
        "type": "path",
        "cue": "key-becomes-legible"
      }
    ]
  },
  {
    "id": "thorn-house.key-recognised",
    "sceneId": "thorned.self-owned-world",
    "trigger": "touch",
    "objectId": "thorn-house.key",
    "actions": [
      {
        "type": "object-state",
        "objectId": "thorn-house.key",
        "state": "recognised"
      },
      {
        "type": "key",
        "keyId": "key.self-permission"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.recover-key"
      },
      {
        "type": "world-flag",
        "flagId": "thorn-door.open"
      },
      {
        "type": "world-flag",
        "flagId": "path.house-exit-open"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.thorn-door",
        "state": "transformed"
      },
      {
        "type": "resonance",
        "key": "wolf",
        "amount": 10
      }
    ]
  },
  {
    "id": "thorn-house.exit-crossed",
    "sceneId": "thorned.self-owned-world",
    "trigger": "volume-enter",
    "objectId": "thorn-house.exit",
    "requires": [
      {
        "type": "event",
        "id": "thorn-house.key-recognised"
      }
    ],
    "actions": [
      {
        "type": "world-flag",
        "flagId": "thorn-house.exit-crossed"
      },
      {
        "type": "object-state",
        "objectId": "thorn-house.exit",
        "state": "open"
      }
    ]
  },
  {
    "id": "integration.swan-passage",
    "sceneId": "wolf-swan.false-choice",
    "trigger": "volume-enter",
    "objectId": "integration.swan",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "integration.swan-witnessed"
      },
      {
        "type": "object-state",
        "objectId": "integration.swan",
        "state": "passage"
      },
      {
        "type": "actor",
        "actor": "swan",
        "cue": "lead"
      },
      {
        "type": "path",
        "cue": "water-passage"
      }
    ]
  },
  {
    "id": "integration.wolf-boundary",
    "sceneId": "wolf-swan.false-choice",
    "trigger": "volume-enter",
    "objectId": "integration.wolf",
    "actions": [
      {
        "type": "world-flag",
        "flagId": "integration.wolf-witnessed"
      },
      {
        "type": "object-state",
        "objectId": "integration.wolf",
        "state": "boundary"
      },
      {
        "type": "actor",
        "actor": "wolf",
        "cue": "wait"
      },
      {
        "type": "path",
        "cue": "thorn-opening"
      }
    ]
  },
  {
    "id": "integration.seer-truth",
    "sceneId": "wolf-swan.false-choice",
    "trigger": "stillness",
    "objectId": "integration.seer",
    "durationMs": 2500,
    "requires": [
      {
        "type": "event",
        "id": "integration.swan-passage"
      },
      {
        "type": "event",
        "id": "integration.wolf-boundary"
      }
    ],
    "actions": [
      {
        "type": "world-flag",
        "flagId": "integration.seer-witnessed"
      },
      {
        "type": "object-state",
        "objectId": "integration.seer",
        "state": "aligned"
      },
      {
        "type": "actor",
        "actor": "seer",
        "cue": "reveal"
      }
    ]
  },
  {
    "id": "integration.three-capacities",
    "sceneId": "wolf-swan.convergence",
    "trigger": "stillness",
    "objectId": "integration.meeting",
    "durationMs": 2600,
    "actions": [
      {
        "type": "world-flag",
        "flagId": "integration.three-aspects-held"
      },
      {
        "type": "object-state",
        "objectId": "integration.meeting",
        "state": "aligned"
      },
      {
        "type": "path",
        "cue": "three-capacities-align"
      }
    ]
  },
  {
    "id": "fire.false-promise.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.false-promise",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.false-promise",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.false-promise.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.false-promise",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.false-promise",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.false-promise",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.false-promise",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.old-marker.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.old-marker",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.old-marker",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.old-marker.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.old-marker",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.old-marker",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.old-marker",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.old-marker",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.empty-frame.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.empty-frame",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.empty-frame",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.empty-frame.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.empty-frame",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.empty-frame",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.empty-frame",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.empty-frame",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.broken-key.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.broken-key",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.broken-key",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.broken-key.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.broken-key",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.broken-key",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.broken-key",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.broken-key",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.dead-flower.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.dead-flower",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.dead-flower",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.dead-flower.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.dead-flower",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.dead-flower",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.dead-flower",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.dead-flower",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.letter.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.letter",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.letter",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.letter.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.letter",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.letter",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.letter",
        "state": "burned"
      },
      {
        "type": "placement",
        "objectId": "fire.letter",
        "targetId": "fire.flame"
      },
      {
        "type": "sound",
        "cue": "restrained-ash"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.true-memory.take",
    "sceneId": "fire.boundary",
    "trigger": "pickup",
    "objectId": "fire.true-memory",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.true-memory",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fire.true-memory.flame",
    "sceneId": "fire.boundary",
    "trigger": "burn",
    "objectId": "fire.true-memory",
    "targetId": "fire.flame",
    "requires": [
      {
        "type": "object",
        "id": "fire.true-memory",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fire.true-memory",
        "state": "preserved"
      },
      {
        "type": "placement",
        "objectId": "fire.true-memory",
        "targetId": "fire.flame"
      },
      {
        "type": "silence",
        "cue": "flame-refuses-memory"
      },
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "present"
      }
    ]
  },
  {
    "id": "fire.boundary-complete",
    "sceneId": "fire.boundary",
    "trigger": "stillness",
    "objectId": "fire.flame",
    "durationMs": 2800,
    "requires": [
      {
        "type": "event",
        "id": "fire.false-promise.flame"
      },
      {
        "type": "event",
        "id": "fire.old-marker.flame"
      },
      {
        "type": "event",
        "id": "fire.empty-frame.flame"
      },
      {
        "type": "event",
        "id": "fire.broken-key.flame"
      },
      {
        "type": "event",
        "id": "fire.dead-flower.flame"
      },
      {
        "type": "event",
        "id": "fire.letter.flame"
      },
      {
        "type": "event",
        "id": "fire.true-memory.flame"
      }
    ],
    "actions": [
      {
        "type": "world-flag",
        "flagId": "fire.boundary-burned"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.burn-boundary"
      },
      {
        "type": "environment",
        "cue": "fire-softens-around-memory"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.fire-river",
        "state": "scarred"
      },
      {
        "type": "resonance",
        "key": "wolf",
        "amount": 9
      }
    ]
  },
  {
    "id": "river.entered",
    "sceneId": "river.wash",
    "trigger": "volume-enter",
    "objectId": "river.water",
    "actions": [
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "loosening"
      },
      {
        "type": "sound",
        "cue": "wide-water"
      }
    ]
  },
  {
    "id": "river.ash-washed",
    "sceneId": "river.wash",
    "trigger": "wash",
    "objectId": "river.water",
    "requires": [
      {
        "type": "event",
        "id": "river.entered"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "river.soot",
        "state": "washed"
      },
      {
        "type": "world-flag",
        "flagId": "river.grief-washed"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.wash-grief"
      },
      {
        "type": "environment",
        "cue": "ash-leaves-memory-remains"
      },
      {
        "type": "resonance",
        "key": "swan",
        "amount": 9
      }
    ]
  },
  {
    "id": "river.birds-released",
    "sceneId": "river.release-surrender",
    "trigger": "release",
    "objectId": "river.birds",
    "actions": [
      {
        "type": "object-state",
        "objectId": "river.birds",
        "state": "released"
      },
      {
        "type": "world-flag",
        "flagId": "river.memory-released"
      },
      {
        "type": "world-flag",
        "flagId": "birds.black-swarm-released"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.release-river-memory"
      },
      {
        "type": "actor",
        "actor": "birds",
        "cue": "separate-and-depart"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.fire-river",
        "state": "released"
      },
      {
        "type": "release-word",
        "word": "hope"
      }
    ]
  },
  {
    "id": "river.surrender",
    "sceneId": "river.release-surrender",
    "trigger": "stillness",
    "objectId": "river.white-fabric",
    "durationMs": 7600,
    "requires": [
      {
        "type": "event",
        "id": "river.birds-released"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "river.white-fabric",
        "state": "raised"
      },
      {
        "type": "world-flag",
        "flagId": "surrender.white-flag-raised"
      },
      {
        "type": "world-flag",
        "flagId": "path.crowned-return-visible"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.surrender"
      },
      {
        "type": "actor",
        "actor": "wolf",
        "cue": "rest"
      },
      {
        "type": "actor",
        "actor": "swan",
        "cue": "rest"
      },
      {
        "type": "actor",
        "actor": "seer",
        "cue": "hide"
      },
      {
        "type": "silence",
        "cue": "world-stops"
      },
      {
        "type": "resonance",
        "key": "wolf",
        "amount": 4
      },
      {
        "type": "resonance",
        "key": "swan",
        "amount": 4
      },
      {
        "type": "resonance",
        "key": "seer",
        "amount": 4
      }
    ]
  },
  {
    "id": "fork.past-entered",
    "sceneId": "fork.weighing",
    "trigger": "volume-enter",
    "objectId": "fork.past",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.past",
        "state": "entered"
      },
      {
        "type": "environment",
        "cue": "past-warmth-returns"
      }
    ]
  },
  {
    "id": "fork.past-looped",
    "sceneId": "fork.weighing",
    "trigger": "volume-exit",
    "objectId": "fork.past",
    "requires": [
      {
        "type": "event",
        "id": "fork.past-entered"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.past",
        "state": "looped"
      },
      {
        "type": "path",
        "cue": "familiar-route-returns"
      }
    ]
  },
  {
    "id": "fork.weighed",
    "sceneId": "fork.weighing",
    "trigger": "stillness",
    "objectId": "fork.weighing-stone",
    "durationMs": 3200,
    "requires": [
      {
        "type": "event",
        "id": "fork.past-looped"
      }
    ],
    "actions": [
      {
        "type": "world-flag",
        "flagId": "fork.weighed"
      },
      {
        "type": "silence",
        "cue": "mourning-the-familiar"
      }
    ]
  },
  {
    "id": "fork.token-carried",
    "sceneId": "fork.four-verbs",
    "trigger": "pickup",
    "objectId": "fork.token",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.token",
        "state": "carried"
      }
    ]
  },
  {
    "id": "fork.let-go",
    "sceneId": "fork.four-verbs",
    "trigger": "release",
    "objectId": "fork.token",
    "targetId": "fork.current",
    "requires": [
      {
        "type": "object",
        "id": "fork.token",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.token",
        "state": "released"
      },
      {
        "type": "world-flag",
        "flagId": "fork.let-go"
      }
    ]
  },
  {
    "id": "fork.declined",
    "sceneId": "fork.four-verbs",
    "trigger": "close",
    "objectId": "fork.door",
    "requires": [
      {
        "type": "event",
        "id": "fork.let-go"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.door",
        "state": "closed"
      },
      {
        "type": "world-flag",
        "flagId": "fork.declined"
      }
    ]
  },
  {
    "id": "fork.departed",
    "sceneId": "fork.four-verbs",
    "trigger": "volume-exit",
    "objectId": "fork.door",
    "requires": [
      {
        "type": "event",
        "id": "fork.declined"
      }
    ],
    "actions": [
      {
        "type": "world-flag",
        "flagId": "fork.departed"
      },
      {
        "type": "sound",
        "cue": "past-stays-behind"
      }
    ]
  },
  {
    "id": "fork.deleted",
    "sceneId": "fork.four-verbs",
    "trigger": "wipe",
    "objectId": "fork.mark",
    "requires": [
      {
        "type": "event",
        "id": "fork.departed"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.mark",
        "state": "erased"
      },
      {
        "type": "world-flag",
        "flagId": "fork.deleted"
      },
      {
        "type": "environment",
        "cue": "clearer-air"
      }
    ]
  },
  {
    "id": "fork.hope-relinquished",
    "sceneId": "fork.relinquish-hope",
    "trigger": "release",
    "objectId": "fork.hope",
    "actions": [
      {
        "type": "object-state",
        "objectId": "fork.hope",
        "state": "released"
      },
      {
        "type": "world-flag",
        "flagId": "fork.old-hope-relinquished"
      }
    ]
  },
  {
    "id": "lantern.owned",
    "sceneId": "fork.relinquish-hope",
    "trigger": "pickup",
    "objectId": "lantern.master",
    "requires": [
      {
        "type": "event",
        "id": "fork.hope-relinquished"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "lantern.master",
        "state": "carried"
      },
      {
        "type": "lantern"
      },
      {
        "type": "world-flag",
        "flagId": "lantern.owned"
      },
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "follow"
      },
      {
        "type": "camera",
        "cue": "guidance-recedes"
      }
    ]
  },
  {
    "id": "climbs.ascent-seen",
    "sceneId": "climbs.arrival",
    "trigger": "volume-enter",
    "objectId": "climbs.horizon",
    "actions": [
      {
        "type": "object-state",
        "objectId": "climbs.horizon",
        "state": "visible"
      },
      {
        "type": "environment",
        "cue": "uninterrupted-ascent"
      }
    ]
  },
  {
    "id": "mind.questions-examined",
    "sceneId": "climb.mind",
    "trigger": "gaze",
    "objectId": "mind.questions",
    "durationMs": 1300,
    "actions": [
      {
        "type": "object-state",
        "objectId": "mind.questions",
        "state": "dense"
      },
      {
        "type": "environment",
        "cue": "questions-proliferate"
      }
    ],
    "optional": true
  },
  {
    "id": "mind.questions-left",
    "sceneId": "climb.mind",
    "trigger": "volume-enter",
    "objectId": "mind.onward",
    "actions": [
      {
        "type": "object-state",
        "objectId": "mind.questions",
        "state": "behind"
      },
      {
        "type": "world-flag",
        "flagId": "climb.mind.questions-released"
      },
      {
        "type": "sound",
        "cue": "questions-fade-with-distance"
      }
    ]
  },
  {
    "id": "heart.rose.chosen",
    "sceneId": "climb.heart",
    "trigger": "pickup",
    "objectId": "heart.rose",
    "actions": [
      {
        "type": "object-state",
        "objectId": "heart.rose",
        "state": "carried"
      },
      {
        "type": "object-state",
        "objectId": "heart.memory",
        "state": "blush-rose"
      },
      {
        "type": "symbol",
        "objectId": "memory.chosen-heart"
      },
      {
        "type": "symbol",
        "objectId": "memory.heart.tenderness"
      },
      {
        "type": "world-flag",
        "flagId": "climb.heart.memory-chosen"
      }
    ],
    "completionGroup": "heart.choice"
  },
  {
    "id": "heart.feather.chosen",
    "sceneId": "climb.heart",
    "trigger": "pickup",
    "objectId": "heart.feather",
    "actions": [
      {
        "type": "object-state",
        "objectId": "heart.feather",
        "state": "carried"
      },
      {
        "type": "object-state",
        "objectId": "heart.memory",
        "state": "swan-feather"
      },
      {
        "type": "symbol",
        "objectId": "memory.chosen-heart"
      },
      {
        "type": "symbol",
        "objectId": "memory.heart.beauty"
      },
      {
        "type": "world-flag",
        "flagId": "climb.heart.memory-chosen"
      }
    ],
    "completionGroup": "heart.choice"
  },
  {
    "id": "heart.reflection.chosen",
    "sceneId": "climb.heart",
    "trigger": "pickup",
    "objectId": "heart.reflection",
    "actions": [
      {
        "type": "object-state",
        "objectId": "heart.reflection",
        "state": "carried"
      },
      {
        "type": "object-state",
        "objectId": "heart.memory",
        "state": "blue-moon-reflection"
      },
      {
        "type": "symbol",
        "objectId": "memory.chosen-heart"
      },
      {
        "type": "symbol",
        "objectId": "memory.heart.selfhood"
      },
      {
        "type": "world-flag",
        "flagId": "climb.heart.memory-chosen"
      }
    ],
    "completionGroup": "heart.choice"
  },
  {
    "id": "womb.linen.take",
    "sceneId": "climb.womb",
    "trigger": "pickup",
    "objectId": "womb.linen",
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.linen",
        "state": "carried"
      }
    ],
    "completionGroup": "womb.material"
  },
  {
    "id": "womb.linen.created",
    "sceneId": "climb.womb",
    "trigger": "place",
    "objectId": "womb.linen",
    "targetId": "womb.rest-space",
    "requires": [
      {
        "type": "object",
        "id": "womb.linen",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.linen",
        "state": "created"
      },
      {
        "type": "placement",
        "objectId": "womb.linen",
        "targetId": "womb.rest-space"
      },
      {
        "type": "object-state",
        "objectId": "womb.creation",
        "state": "rest"
      },
      {
        "type": "symbol",
        "objectId": "creation.chosen-future"
      },
      {
        "type": "symbol",
        "objectId": "creation.future.rest"
      },
      {
        "type": "world-flag",
        "flagId": "climb.womb.creation-chosen"
      },
      {
        "type": "environment",
        "cue": "creation-grows"
      },
      {
        "type": "sound",
        "cue": "new-harmonic-layer"
      }
    ],
    "completionGroup": "womb.creation"
  },
  {
    "id": "womb.light.take",
    "sceneId": "climb.womb",
    "trigger": "pickup",
    "objectId": "womb.light",
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.light",
        "state": "carried"
      }
    ],
    "completionGroup": "womb.material"
  },
  {
    "id": "womb.light.created",
    "sceneId": "climb.womb",
    "trigger": "place",
    "objectId": "womb.light",
    "targetId": "womb.threshold",
    "requires": [
      {
        "type": "object",
        "id": "womb.light",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.light",
        "state": "created"
      },
      {
        "type": "placement",
        "objectId": "womb.light",
        "targetId": "womb.threshold"
      },
      {
        "type": "object-state",
        "objectId": "womb.creation",
        "state": "home"
      },
      {
        "type": "symbol",
        "objectId": "creation.chosen-future"
      },
      {
        "type": "symbol",
        "objectId": "creation.future.home"
      },
      {
        "type": "world-flag",
        "flagId": "climb.womb.creation-chosen"
      },
      {
        "type": "environment",
        "cue": "creation-grows"
      },
      {
        "type": "sound",
        "cue": "new-harmonic-layer"
      }
    ],
    "completionGroup": "womb.creation"
  },
  {
    "id": "womb.page.take",
    "sceneId": "climb.womb",
    "trigger": "pickup",
    "objectId": "womb.page",
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.page",
        "state": "carried"
      }
    ],
    "completionGroup": "womb.material"
  },
  {
    "id": "womb.page.created",
    "sceneId": "climb.womb",
    "trigger": "place",
    "objectId": "womb.page",
    "targetId": "womb.writing-place",
    "requires": [
      {
        "type": "object",
        "id": "womb.page",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "womb.page",
        "state": "created"
      },
      {
        "type": "placement",
        "objectId": "womb.page",
        "targetId": "womb.writing-place"
      },
      {
        "type": "object-state",
        "objectId": "womb.creation",
        "state": "voice"
      },
      {
        "type": "symbol",
        "objectId": "creation.chosen-future"
      },
      {
        "type": "symbol",
        "objectId": "creation.future.voice"
      },
      {
        "type": "world-flag",
        "flagId": "climb.womb.creation-chosen"
      },
      {
        "type": "environment",
        "cue": "creation-grows"
      },
      {
        "type": "sound",
        "cue": "new-harmonic-layer"
      }
    ],
    "completionGroup": "womb.creation"
  },
  {
    "id": "home.gate-recognises-keys",
    "sceneId": "crowned.threshold",
    "trigger": "volume-enter",
    "objectId": "home.gate",
    "requires": [
      {
        "type": "key",
        "id": "key.protection"
      },
      {
        "type": "key",
        "id": "key.self-permission"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.gate",
        "state": "open"
      },
      {
        "type": "path",
        "cue": "keys-recognise-home"
      }
    ]
  },
  {
    "id": "home.continuity",
    "sceneId": "crowned.home",
    "trigger": "scene-enter",
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.continuity",
        "state": "present"
      },
      {
        "type": "environment",
        "cue": "heart-and-creation-at-home"
      }
    ]
  },
  {
    "id": "home.water.visited",
    "sceneId": "crowned.home",
    "trigger": "touch",
    "objectId": "home.water",
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.water",
        "state": "rippled"
      }
    ],
    "optional": true
  },
  {
    "id": "home.book.visited",
    "sceneId": "crowned.home",
    "trigger": "open",
    "objectId": "home.book",
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.book",
        "state": "open"
      }
    ],
    "optional": true
  },
  {
    "id": "home.child-space.visited",
    "sceneId": "crowned.home",
    "trigger": "inspect",
    "objectId": "home.child-space",
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.child-space",
        "state": "protected"
      }
    ],
    "optional": true
  },
  {
    "id": "home.window.visited",
    "sceneId": "crowned.home",
    "trigger": "open",
    "objectId": "home.window",
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.window",
        "state": "open"
      }
    ],
    "optional": true
  },
  {
    "id": "home.private-room-opened",
    "sceneId": "crowned.home",
    "trigger": "volume-enter",
    "objectId": "home.private-room",
    "requires": [
      {
        "type": "key",
        "id": "key.self-permission"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.private-room",
        "state": "open"
      }
    ],
    "optional": true
  },
  {
    "id": "crown.recognised",
    "sceneId": "crowned.sovereignty",
    "trigger": "gaze",
    "objectId": "home.crown-mirror",
    "durationMs": 3200,
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.crown-mirror",
        "state": "recognised"
      },
      {
        "type": "silence",
        "cue": "crown-recognition"
      },
      {
        "type": "environment",
        "cue": "crown-only-in-reflection"
      }
    ]
  },
  {
    "id": "crown.integrated",
    "sceneId": "crowned.sovereignty",
    "trigger": "touch",
    "objectId": "home.crown-mirror",
    "requires": [
      {
        "type": "event",
        "id": "crown.recognised"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "home.crown-mirror",
        "state": "integrated"
      }
    ],
    "optional": true
  },
  {
    "id": "lantern.placed.mirror",
    "sceneId": "crowned.sovereignty",
    "trigger": "place",
    "objectId": "lantern.master",
    "targetId": "mirror",
    "requires": [
      {
        "type": "event",
        "id": "crown.recognised"
      },
      {
        "type": "object",
        "id": "lantern.master",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "lantern.master",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "lantern.master",
        "targetId": "mirror"
      },
      {
        "type": "object-state",
        "objectId": "lantern.final-placement",
        "state": "mirror"
      },
      {
        "type": "world-flag",
        "flagId": "lantern.placed-and-lit"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.place-lantern"
      },
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "rest"
      },
      {
        "type": "silence",
        "cue": "placed-light"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.crowned-gate",
        "state": "released"
      }
    ],
    "completionGroup": "lantern.placement"
  },
  {
    "id": "lantern.placed.reading-nook",
    "sceneId": "crowned.sovereignty",
    "trigger": "place",
    "objectId": "lantern.master",
    "targetId": "reading-nook",
    "requires": [
      {
        "type": "event",
        "id": "crown.recognised"
      },
      {
        "type": "object",
        "id": "lantern.master",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "lantern.master",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "lantern.master",
        "targetId": "reading-nook"
      },
      {
        "type": "object-state",
        "objectId": "lantern.final-placement",
        "state": "reading-nook"
      },
      {
        "type": "world-flag",
        "flagId": "lantern.placed-and-lit"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.place-lantern"
      },
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "rest"
      },
      {
        "type": "silence",
        "cue": "placed-light"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.crowned-gate",
        "state": "released"
      }
    ],
    "completionGroup": "lantern.placement"
  },
  {
    "id": "lantern.placed.fountain",
    "sceneId": "crowned.sovereignty",
    "trigger": "place",
    "objectId": "lantern.master",
    "targetId": "fountain",
    "requires": [
      {
        "type": "event",
        "id": "crown.recognised"
      },
      {
        "type": "object",
        "id": "lantern.master",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "lantern.master",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "lantern.master",
        "targetId": "fountain"
      },
      {
        "type": "object-state",
        "objectId": "lantern.final-placement",
        "state": "fountain"
      },
      {
        "type": "world-flag",
        "flagId": "lantern.placed-and-lit"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.place-lantern"
      },
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "rest"
      },
      {
        "type": "silence",
        "cue": "placed-light"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.crowned-gate",
        "state": "released"
      }
    ],
    "completionGroup": "lantern.placement"
  },
  {
    "id": "lantern.placed.window",
    "sceneId": "crowned.sovereignty",
    "trigger": "place",
    "objectId": "lantern.master",
    "targetId": "window",
    "requires": [
      {
        "type": "event",
        "id": "crown.recognised"
      },
      {
        "type": "object",
        "id": "lantern.master",
        "state": "carried"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "lantern.master",
        "state": "placed"
      },
      {
        "type": "placement",
        "objectId": "lantern.master",
        "targetId": "window"
      },
      {
        "type": "object-state",
        "objectId": "lantern.final-placement",
        "state": "window"
      },
      {
        "type": "world-flag",
        "flagId": "lantern.placed-and-lit"
      },
      {
        "type": "ritual",
        "ritualId": "ritual.place-lantern"
      },
      {
        "type": "actor",
        "actor": "lantern",
        "cue": "rest"
      },
      {
        "type": "silence",
        "cue": "placed-light"
      },
      {
        "type": "landmark",
        "landmarkId": "landmark.crowned-gate",
        "state": "released"
      }
    ],
    "completionGroup": "lantern.placement"
  },
  {
    "id": "epilogue.reverse-light-started",
    "sceneId": "epilogue.constellation",
    "trigger": "scene-enter",
    "requires": [
      {
        "type": "flag",
        "id": "lantern.placed-and-lit"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "epilogue.reverse-light",
        "state": "running"
      },
      {
        "type": "environment",
        "cue": "reverse-light"
      }
    ]
  },
  {
    "id": "epilogue.reverse-light-complete",
    "sceneId": "epilogue.constellation",
    "trigger": "sequence-complete",
    "durationMs": 24000,
    "requires": [
      {
        "type": "event",
        "id": "epilogue.reverse-light-started"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "epilogue.reverse-light",
        "state": "complete"
      },
      {
        "type": "environment",
        "cue": "landmarks-become-stars"
      }
    ]
  },
  {
    "id": "epilogue.constellation-seen",
    "sceneId": "epilogue.constellation",
    "trigger": "stillness",
    "durationMs": 4200,
    "requires": [
      {
        "type": "event",
        "id": "epilogue.reverse-light-complete"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "epilogue.constellation",
        "state": "witnessed"
      },
      {
        "type": "prose",
        "cue": "fragment-046"
      }
    ]
  },
  {
    "id": "nest.unsupported-cycle.recover-protected-linen",
    "sceneId": "nest.unsupported-cycle",
    "trigger": "pickup",
    "objectId": "nest.protected-linen",
    "requires": [
      {
        "type": "object",
        "id": "nest.protected-linen",
        "state": "resting"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.protected-linen",
        "state": "carried"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.unsupported-cycle.recover-responsibility",
    "sceneId": "nest.unsupported-cycle",
    "trigger": "pickup",
    "objectId": "nest.responsibility",
    "requires": [
      {
        "type": "object",
        "id": "nest.responsibility",
        "state": "resting"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.responsibility",
        "state": "carried"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.protection.recover-protected-linen",
    "sceneId": "nest.protection",
    "trigger": "pickup",
    "objectId": "nest.protected-linen",
    "requires": [
      {
        "type": "object",
        "id": "nest.protected-linen",
        "state": "resting"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.protected-linen",
        "state": "carried"
      }
    ],
    "optional": true
  },
  {
    "id": "nest.protection.recover-responsibility",
    "sceneId": "nest.protection",
    "trigger": "pickup",
    "objectId": "nest.responsibility",
    "requires": [
      {
        "type": "object",
        "id": "nest.responsibility",
        "state": "resting"
      }
    ],
    "actions": [
      {
        "type": "object-state",
        "objectId": "nest.responsibility",
        "state": "carried"
      }
    ],
    "optional": true
  }
] as const satisfies readonly StoryEventDefinition[];
