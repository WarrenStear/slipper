import {
  JOURNEY_CHAPTER_IDS as NARRATIVE_CHAPTER_IDS,
  JOURNEY_SCENE_IDS,
  type JourneyChapterId as NarrativeChapterId,
  type JourneySceneId,
} from "../lib/storyJourneyState.ts";
import {
  JOURNEY_ENTRY_CONTEXT,
  JOURNEY_TECHNICAL_BIOMES as TECHNICAL_BIOMES,
  journeyScenes,
  type JourneyTechnicalBiome as TechnicalBiome,
} from "./journeyNarrative.ts";

export { NARRATIVE_CHAPTER_IDS, JOURNEY_SCENE_IDS, TECHNICAL_BIOMES };
export type { NarrativeChapterId, JourneySceneId, TechnicalBiome };

/**
 * Authored, renderer-agnostic geography for the canonical journey.
 *
 * This module deliberately contains only serializable primitives. Renderers may
 * translate the tuples into Three.js vectors, but story geography must not
 * depend on Three.js, procedural maze output, or React component identity.
 */

export type WorldPoint2 = readonly [x: number, z: number];
export type WorldPoint3 = readonly [x: number, y: number, z: number];

export type JourneySceneRole =
  | "arrival"
  | "memory"
  | "ritual"
  | "transition"
  | "reflection"
  | "architectural"
  | "climb"
  | "finale";

export type JourneyWorldAnchor = {
  position: WorldPoint3;
  /** Clockwise yaw in radians, where zero faces positive Z. */
  headingRadians: number;
};

export type JourneySceneBounds = {
  min: WorldPoint3;
  max: WorldPoint3;
};

export type JourneySceneGateway = {
  id: string;
  role: "origin" | "entry" | "exit" | "terminus";
  position: WorldPoint3;
  connectsToSceneId?: JourneySceneId;
};

export type JourneySceneLayout = {
  id: JourneySceneId;
  order: number;
  title: string;
  chapterId: NarrativeChapterId;
  biome: TechnicalBiome;
  role: JourneySceneRole;
  anchor: JourneyWorldAnchor;
  bounds: JourneySceneBounds;
  gateways: readonly JourneySceneGateway[];
};

export type NarrativeChapterLayout = {
  id: NarrativeChapterId;
  order: number;
  title: string;
  biome: TechnicalBiome;
  anchorSceneId: JourneySceneId;
  anchor: JourneyWorldAnchor;
  sceneIds: readonly JourneySceneId[];
};

export type JourneyMainRouteSegment = {
  id: string;
  order: number;
  role: "primary";
  fromSceneId: JourneySceneId;
  toSceneId: JourneySceneId;
  fromGatewayId: string;
  toGatewayId: string;
};

export type ProceduralTreeExclusionVolume =
  | {
      id: string;
      kind: "box";
      sceneIds: readonly JourneySceneId[];
      center: WorldPoint3;
      halfExtents: WorldPoint3;
    }
  | {
      id: string;
      kind: "cylinder";
      sceneIds: readonly JourneySceneId[];
      center: WorldPoint3;
      radius: number;
      halfHeight: number;
    }
  | {
      id: string;
      kind: "corridor";
      sceneIds: readonly JourneySceneId[];
      start: WorldPoint3;
      end: WorldPoint3;
      radius: number;
      halfHeight: number;
    };

export type EchoSpurAttachment = {
  id: string;
  sceneId: JourneySceneId;
  attachmentPosition: WorldPoint3;
  headingRadians: number;
  length: number;
  width: number;
  maxEchoes: number;
};

export type JourneyWorldLayout = {
  version: number;
  coordinateSystem: {
    units: "meters";
    upAxis: "y";
    routeForwardAxis: "positive-z";
  };
  chapters: readonly NarrativeChapterLayout[];
  scenes: readonly JourneySceneLayout[];
  mainRoute: readonly JourneyMainRouteSegment[];
  proceduralTreeExclusions: readonly ProceduralTreeExclusionVolume[];
  echoSpurAttachments: readonly EchoSpurAttachment[];
};

export type JourneyRenderWindowEntry = {
  sceneId: JourneySceneId;
  mode: "active" | "adjacent";
  routeOffset: -1 | 0 | 1;
};

export type JourneyRenderWindow = {
  activeSceneId: JourneySceneId;
  activeSceneIds: readonly [JourneySceneId];
  adjacentSceneIds: readonly JourneySceneId[];
  entries: readonly JourneyRenderWindowEntry[];
};

export type JourneyWorldLayoutValidationIssue = {
  code: string;
  message: string;
};

export type JourneyEntryWorldPlacement = {
  entryId: string;
  sceneId: JourneySceneId;
  role: "keystone" | "echo";
  position: WorldPoint3;
  clearingRadius: number;
  elevated: boolean;
};

type ChapterSeed = {
  id: NarrativeChapterId;
  title: string;
  biome: TechnicalBiome;
  anchorSceneId: JourneySceneId;
};

type EchoSpurSeed = {
  side: "left" | "right";
  length: number;
  maxEchoes: number;
};

type SceneSeed = {
  id: JourneySceneId;
  title: string;
  chapterId: NarrativeChapterId;
  role: JourneySceneRole;
  position: WorldPoint3;
  halfExtents: WorldPoint3;
  treeExclusion: "box" | "cylinder";
  echoSpur?: EchoSpurSeed;
};

const CHAPTER_SEEDS = [
  {
    id: "broken-floor",
    title: "Prologue — The Broken Floor",
    biome: "firstWood",
    anchorSceneId: "broken-floor.confession",
  },
  {
    id: "enchanted-wood",
    title: "The Enchanted Wood",
    biome: "firstWood",
    anchorSceneId: "enchanted.friendship-meadow",
  },
  {
    id: "blue-moon-sanctuary",
    title: "The Blue Moon Sanctuary",
    biome: "archive",
    anchorSceneId: "blue-moon.sanctuary",
  },
  {
    id: "nest",
    title: "The Nest",
    biome: "firstWood",
    anchorSceneId: "nest.two-hands",
  },
  {
    id: "sunset-seer",
    title: "The Sunset Seer",
    biome: "mirror",
    anchorSceneId: "sunset.true-mirror",
  },
  {
    id: "thorned-house",
    title: "The Thorned House",
    biome: "thorned",
    anchorSceneId: "thorned.old-memory-bedroom",
  },
  {
    id: "wolf-swan-seer",
    title: "Wolf, Swan & Seer",
    biome: "mirror",
    anchorSceneId: "wolf-swan.convergence",
  },
  {
    id: "fire-river",
    title: "Fire and River",
    biome: "fireRiver",
    anchorSceneId: "river.release-surrender",
  },
  {
    id: "fork",
    title: "The Fork in the Woods",
    biome: "firstWood",
    anchorSceneId: "fork.weighing",
  },
  {
    id: "three-climbs",
    title: "The Three Climbs",
    biome: "crowned",
    anchorSceneId: "climbs.arrival",
  },
  {
    id: "crowned-return",
    title: "The Crowned Return",
    biome: "crowned",
    anchorSceneId: "crowned.home",
  },
  {
    id: "lantern-epilogue",
    title: "Epilogue — The Lanterns Left Along the Way",
    biome: "crowned",
    anchorSceneId: "epilogue.constellation",
  },
] as const satisfies readonly ChapterSeed[];

// The route advances broadly along +Z while lateral offsets keep sightlines
// authored and prevent the journey from reading as a straight corridor.
const SCENE_SEEDS: readonly SceneSeed[] = [
  {
    id: "broken-floor.confession",
    title: "The Confession Below the Floor",
    chapterId: "broken-floor",
    role: "arrival",
    position: [0, -4, -378],
    halfExtents: [13, 6, 12],
    treeExclusion: "box",
  },
  {
    id: "enchanted.rabbit-hole",
    title: "The Rabbit Hole",
    chapterId: "enchanted-wood",
    role: "transition",
    position: [-8, 0, -354],
    halfExtents: [11, 8, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 13, maxEchoes: 2 },
  },
  {
    id: "enchanted.friendship-meadow",
    title: "The Friendship Meadow",
    chapterId: "enchanted-wood",
    role: "memory",
    position: [10, 1, -330],
    halfExtents: [14, 8, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 15, maxEchoes: 2 },
  },
  {
    id: "enchanted.masked-hearth",
    title: "The Masked Hearth",
    chapterId: "enchanted-wood",
    role: "memory",
    position: [-6, 0, -306],
    halfExtents: [11, 8, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 12, maxEchoes: 2 },
  },
  {
    id: "blue-moon.sanctuary",
    title: "The Water Sanctuary",
    chapterId: "blue-moon-sanctuary",
    role: "architectural",
    position: [-14, -0.5, -278],
    halfExtents: [22, 8, 15],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 17, maxEchoes: 2 },
  },
  {
    id: "blue-moon.intimacy",
    title: "The Intimacy Pavilion",
    chapterId: "blue-moon-sanctuary",
    role: "memory",
    position: [4, -0.25, -252],
    halfExtents: [16, 7, 11],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 14, maxEchoes: 2 },
  },
  {
    id: "blue-moon.caged-bird",
    title: "The Caged Swan",
    chapterId: "blue-moon-sanctuary",
    role: "ritual",
    position: [16, 0, -226],
    halfExtents: [12, 8, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 11, maxEchoes: 1 },
  },
  {
    id: "nest.two-hands",
    title: "The Two Hands",
    chapterId: "nest",
    role: "ritual",
    position: [8, 1, -200],
    halfExtents: [14, 7, 11],
    treeExclusion: "box",
    echoSpur: { side: "left", length: 13, maxEchoes: 2 },
  },
  {
    id: "nest.unsupported-cycle",
    title: "The Unsupported Cycle",
    chapterId: "nest",
    role: "memory",
    position: [-8, 1, -176],
    halfExtents: [12, 7, 10],
    treeExclusion: "box",
    echoSpur: { side: "right", length: 12, maxEchoes: 2 },
  },
  {
    id: "nest.protection",
    title: "The Protection Key",
    chapterId: "nest",
    role: "ritual",
    position: [4, 1, -152],
    halfExtents: [14, 7, 10],
    treeExclusion: "box",
  },
  {
    id: "sunset.warning-grove",
    title: "The Warning Grove",
    chapterId: "sunset-seer",
    role: "memory",
    position: [18, 0, -126],
    halfExtents: [13, 7, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 13, maxEchoes: 2 },
  },
  {
    id: "sunset.true-mirror",
    title: "The True Mirror",
    chapterId: "sunset-seer",
    role: "reflection",
    position: [0, -0.5, -102],
    halfExtents: [18, 6, 12],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 15, maxEchoes: 2 },
  },
  {
    id: "sunset.stillness",
    title: "The Still Water",
    chapterId: "sunset-seer",
    role: "ritual",
    position: [-14, -0.5, -78],
    halfExtents: [15, 6, 11],
    treeExclusion: "cylinder",
  },
  {
    id: "thorned.locked-garden",
    title: "The Locked Garden",
    chapterId: "thorned-house",
    role: "architectural",
    position: [-6, 0, -50],
    halfExtents: [16, 10, 12],
    treeExclusion: "box",
    echoSpur: { side: "left", length: 13, maxEchoes: 2 },
  },
  {
    id: "thorned.old-memory-bedroom",
    title: "The Old-Memory Bedroom",
    chapterId: "thorned-house",
    role: "memory",
    position: [8, 1, -24],
    halfExtents: [14, 9, 11],
    treeExclusion: "box",
    echoSpur: { side: "right", length: 12, maxEchoes: 2 },
  },
  {
    id: "thorned.self-owned-world",
    title: "The Self-Owned World",
    chapterId: "thorned-house",
    role: "transition",
    position: [18, 0, 2],
    halfExtents: [12, 8, 10],
    treeExclusion: "box",
  },
  {
    id: "wolf-swan.false-choice",
    title: "The False Choice",
    chapterId: "wolf-swan-seer",
    role: "ritual",
    position: [6, 0, 28],
    halfExtents: [18, 10, 12],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 14, maxEchoes: 2 },
  },
  {
    id: "wolf-swan.convergence",
    title: "Wolf, Swan and Seer Converge",
    chapterId: "wolf-swan-seer",
    role: "ritual",
    position: [-8, 0, 54],
    halfExtents: [20, 10, 13],
    treeExclusion: "cylinder",
  },
  {
    id: "fire.boundary",
    title: "The Fire Boundary",
    chapterId: "fire-river",
    role: "ritual",
    position: [-18, 0, 82],
    halfExtents: [18, 10, 12],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 14, maxEchoes: 2 },
  },
  {
    id: "river.wash",
    title: "The River Wash",
    chapterId: "fire-river",
    role: "ritual",
    position: [14, -1, 110],
    halfExtents: [18, 8, 12],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 14, maxEchoes: 2 },
  },
  {
    id: "river.release-surrender",
    title: "Release and Surrender",
    chapterId: "fire-river",
    role: "ritual",
    position: [0, 0, 138],
    halfExtents: [20, 10, 13],
    treeExclusion: "cylinder",
  },
  {
    id: "fork.weighing",
    title: "The Weighing",
    chapterId: "fork",
    role: "ritual",
    position: [-4, 0, 166],
    halfExtents: [18, 10, 12],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 15, maxEchoes: 2 },
  },
  {
    id: "fork.four-verbs",
    title: "The Four Verbs",
    chapterId: "fork",
    role: "ritual",
    position: [10, 0, 190],
    halfExtents: [16, 10, 10],
    treeExclusion: "cylinder",
  },
  {
    id: "fork.relinquish-hope",
    title: "Relinquish Hope",
    chapterId: "fork",
    role: "transition",
    position: [-10, 0, 214],
    halfExtents: [14, 10, 10],
    treeExclusion: "cylinder",
  },
  {
    id: "climbs.arrival",
    title: "The Three Ascents",
    chapterId: "three-climbs",
    role: "arrival",
    position: [0, 1, 242],
    halfExtents: [18, 12, 12],
    treeExclusion: "cylinder",
  },
  {
    id: "climb.mind",
    title: "The Mind",
    chapterId: "three-climbs",
    role: "climb",
    position: [-14, 6, 268],
    halfExtents: [14, 12, 10],
    treeExclusion: "cylinder",
    echoSpur: { side: "left", length: 11, maxEchoes: 1 },
  },
  {
    id: "climb.heart",
    title: "The Heart",
    chapterId: "three-climbs",
    role: "climb",
    position: [10, 12, 294],
    halfExtents: [16, 12, 11],
    treeExclusion: "cylinder",
    echoSpur: { side: "right", length: 12, maxEchoes: 1 },
  },
  {
    id: "climb.womb",
    title: "The Womb",
    chapterId: "three-climbs",
    role: "climb",
    position: [-2, 18, 320],
    halfExtents: [16, 12, 11],
    treeExclusion: "cylinder",
  },
  {
    id: "crowned.threshold",
    title: "The Quiet Gate",
    chapterId: "crowned-return",
    role: "transition",
    position: [6, 22, 346],
    halfExtents: [18, 12, 12],
    treeExclusion: "box",
  },
  {
    id: "crowned.home",
    title: "The Home She Made",
    chapterId: "crowned-return",
    role: "architectural",
    position: [-8, 24, 370],
    halfExtents: [22, 14, 14],
    treeExclusion: "box",
    echoSpur: { side: "left", length: 12, maxEchoes: 1 },
  },
  {
    id: "crowned.sovereignty",
    title: "Sovereignty",
    chapterId: "crowned-return",
    role: "finale",
    position: [10, 26, 394],
    halfExtents: [18, 14, 11],
    treeExclusion: "box",
  },
  {
    id: "epilogue.constellation",
    title: "The Lanterns Left Along the Way",
    chapterId: "lantern-epilogue",
    role: "finale",
    position: [0, 30, 416],
    halfExtents: [24, 18, 14],
    treeExclusion: "cylinder",
  },
];

function round(value: number) {
  return Math.round(value * 1000) / 1000;
}

function point3(x: number, y: number, z: number): WorldPoint3 {
  return [round(x), round(y), round(z)];
}

function headingBetween(source: WorldPoint3, target: WorldPoint3) {
  return Math.atan2(target[0] - source[0], target[2] - source[2]);
}

function directionForHeading(headingRadians: number): WorldPoint2 {
  return [Math.sin(headingRadians), Math.cos(headingRadians)];
}

function sceneHeading(index: number) {
  const current = SCENE_SEEDS[index];
  const neighbor = SCENE_SEEDS[index + 1] ?? SCENE_SEEDS[index - 1];
  return round(
    index === SCENE_SEEDS.length - 1
      ? headingBetween(neighbor.position, current.position)
      : headingBetween(current.position, neighbor.position),
  );
}

function gatewayPosition(
  sceneIndex: number,
  role: "entry" | "exit",
): WorldPoint3 {
  const scene = SCENE_SEEDS[sceneIndex];
  const neighborIndex = role === "entry" ? sceneIndex - 1 : sceneIndex + 1;
  const neighbor = SCENE_SEEDS[neighborIndex];
  const fallbackNeighbor = role === "entry"
    ? SCENE_SEEDS[sceneIndex + 1]
    : SCENE_SEEDS[sceneIndex - 1];
  const routeNeighbor = neighbor ?? fallbackNeighbor;
  const routeHeading = neighbor
    ? role === "entry"
      ? headingBetween(neighbor.position, scene.position)
      : headingBetween(scene.position, neighbor.position)
    : role === "entry"
      ? headingBetween(scene.position, routeNeighbor.position)
      : headingBetween(routeNeighbor.position, scene.position);
  const direction = directionForHeading(routeHeading);
  const depth = Math.max(2, Math.min(scene.halfExtents[2] - 1.5, 9));
  const sign = role === "entry" ? -1 : 1;
  return point3(
    scene.position[0] + direction[0] * depth * sign,
    scene.position[1],
    scene.position[2] + direction[1] * depth * sign,
  );
}

const CHAPTER_BIOME_BY_ID = Object.fromEntries(
  CHAPTER_SEEDS.map((chapter) => [chapter.id, chapter.biome]),
) as Record<NarrativeChapterId, TechnicalBiome>;

export const JOURNEY_SCENE_LAYOUTS: readonly JourneySceneLayout[] = SCENE_SEEDS.map(
  (scene, index) => {
    const previous = SCENE_SEEDS[index - 1];
    const next = SCENE_SEEDS[index + 1];
    const entryRole = previous ? "entry" : "origin";
    const exitRole = next ? "exit" : "terminus";

    return {
      id: scene.id,
      order: index,
      title: scene.title,
      chapterId: scene.chapterId,
      biome: CHAPTER_BIOME_BY_ID[scene.chapterId],
      role: scene.role,
      anchor: {
        position: scene.position,
        headingRadians: sceneHeading(index),
      },
      bounds: {
        min: point3(
          scene.position[0] - scene.halfExtents[0],
          scene.position[1] - scene.halfExtents[1],
          scene.position[2] - scene.halfExtents[2],
        ),
        max: point3(
          scene.position[0] + scene.halfExtents[0],
          scene.position[1] + scene.halfExtents[1],
          scene.position[2] + scene.halfExtents[2],
        ),
      },
      gateways: [
        {
          id: `${scene.id}.entry`,
          role: entryRole,
          position: gatewayPosition(index, "entry"),
          ...(previous ? { connectsToSceneId: previous.id } : {}),
        },
        {
          id: `${scene.id}.exit`,
          role: exitRole,
          position: gatewayPosition(index, "exit"),
          ...(next ? { connectsToSceneId: next.id } : {}),
        },
      ],
    };
  },
);

const SCENE_LAYOUT_BY_ID = new Map(
  JOURNEY_SCENE_LAYOUTS.map((scene) => [scene.id, scene] as const),
);

export const JOURNEY_CHAPTER_LAYOUTS: readonly NarrativeChapterLayout[] = CHAPTER_SEEDS.map(
  (chapter, order) => {
    const anchorScene = SCENE_LAYOUT_BY_ID.get(chapter.anchorSceneId);
    if (!anchorScene) {
      throw new Error(`Missing anchor scene ${chapter.anchorSceneId} for ${chapter.id}`);
    }

    return {
      id: chapter.id,
      order,
      title: chapter.title,
      biome: chapter.biome,
      anchorSceneId: chapter.anchorSceneId,
      anchor: anchorScene.anchor,
      sceneIds: JOURNEY_SCENE_LAYOUTS
        .filter((scene) => scene.chapterId === chapter.id)
        .map((scene) => scene.id),
    };
  },
);

export const JOURNEY_MAIN_ROUTE: readonly JourneyMainRouteSegment[] = JOURNEY_SCENE_LAYOUTS
  .slice(0, -1)
  .map((scene, order) => {
    const target = JOURNEY_SCENE_LAYOUTS[order + 1];
    return {
      id: `main-route.${String(order + 1).padStart(2, "0")}`,
      order,
      role: "primary",
      fromSceneId: scene.id,
      toSceneId: target.id,
      fromGatewayId: `${scene.id}.exit`,
      toGatewayId: `${target.id}.entry`,
    };
  });

const SCENE_SEED_BY_ID = new Map(SCENE_SEEDS.map((scene) => [scene.id, scene] as const));

const CORE_TREE_EXCLUSIONS: readonly ProceduralTreeExclusionVolume[] = JOURNEY_SCENE_LAYOUTS.map(
  (scene) => {
    const seed = SCENE_SEED_BY_ID.get(scene.id);
    if (!seed) throw new Error(`Missing authored seed for ${scene.id}`);
    const halfExtents = point3(
      (scene.bounds.max[0] - scene.bounds.min[0]) * 0.46,
      (scene.bounds.max[1] - scene.bounds.min[1]) * 0.5,
      (scene.bounds.max[2] - scene.bounds.min[2]) * 0.46,
    );
    if (seed.treeExclusion === "box") {
      return {
        id: `tree-exclusion.${scene.id}.core`,
        kind: "box",
        sceneIds: [scene.id],
        center: scene.anchor.position,
        halfExtents,
      };
    }

    return {
      id: `tree-exclusion.${scene.id}.core`,
      kind: "cylinder",
      sceneIds: [scene.id],
      center: scene.anchor.position,
      radius: round(Math.min(halfExtents[0], halfExtents[2])),
      halfHeight: halfExtents[1],
    };
  },
);

const ROUTE_TREE_EXCLUSIONS: readonly ProceduralTreeExclusionVolume[] = JOURNEY_MAIN_ROUTE.map(
  (segment) => {
    const source = SCENE_LAYOUT_BY_ID.get(segment.fromSceneId);
    const target = SCENE_LAYOUT_BY_ID.get(segment.toSceneId);
    if (!source || !target) {
      throw new Error(`Cannot create exclusion for unresolved route ${segment.id}`);
    }
    const sourceGateway = source.gateways.find((gateway) => gateway.id === segment.fromGatewayId);
    const targetGateway = target.gateways.find((gateway) => gateway.id === segment.toGatewayId);
    if (!sourceGateway || !targetGateway) {
      throw new Error(`Cannot create exclusion for unresolved gateways on ${segment.id}`);
    }
    return {
      id: `tree-exclusion.${segment.id}`,
      kind: "corridor",
      sceneIds: [segment.fromSceneId, segment.toSceneId],
      start: sourceGateway.position,
      end: targetGateway.position,
      radius: 4.4,
      halfHeight: 9,
    };
  },
);

export const PROCEDURAL_TREE_EXCLUSION_VOLUMES: readonly ProceduralTreeExclusionVolume[] = [
  ...CORE_TREE_EXCLUSIONS,
  ...ROUTE_TREE_EXCLUSIONS,
];

export const ECHO_SPUR_ATTACHMENTS: readonly EchoSpurAttachment[] = SCENE_SEEDS.flatMap(
  (scene, index) => {
    if (!scene.echoSpur) return [];
    const headingRadians = sceneHeading(index);
    const sideSign = scene.echoSpur.side === "left" ? -1 : 1;
    const lateralDistance = scene.halfExtents[0] * 0.72;
    const rightX = Math.cos(headingRadians);
    const rightZ = -Math.sin(headingRadians);
    return [{
      id: `echo-spur.${scene.id}`,
      sceneId: scene.id,
      attachmentPosition: point3(
        scene.position[0] + rightX * lateralDistance * sideSign,
        scene.position[1],
        scene.position[2] + rightZ * lateralDistance * sideSign,
      ),
      headingRadians: round(headingRadians + sideSign * Math.PI * 0.5),
      length: scene.echoSpur.length,
      width: 2.6,
      maxEchoes: scene.echoSpur.maxEchoes,
    }];
  },
);

const ECHO_SPUR_BY_SCENE_ID = new Map(
  ECHO_SPUR_ATTACHMENTS.map((spur) => [spur.sceneId, spur] as const),
);

function sceneClearingRadius(scene: JourneySceneLayout) {
  const halfWidth = (scene.bounds.max[0] - scene.bounds.min[0]) * 0.5;
  const halfDepth = (scene.bounds.max[2] - scene.bounds.min[2]) * 0.5;
  return round(Math.max(8.8, Math.max(halfWidth, halfDepth) * 0.92 + 1.4));
}

function echoWorldPosition(
  scene: JourneySceneLayout,
  echoIndex: number,
  echoCount: number,
): WorldPoint3 {
  const spur = ECHO_SPUR_BY_SCENE_ID.get(scene.id);
  if (spur) {
    const direction = directionForHeading(spur.headingRadians);
    const distance = spur.length * ((echoIndex + 1) / (echoCount + 0.42));
    return point3(
      spur.attachmentPosition[0] + direction[0] * distance,
      spur.attachmentPosition[1],
      spur.attachmentPosition[2] + direction[1] * distance,
    );
  }

  // Some Echoes are environmental discoveries inside the substantial scene
  // rather than separate path destinations. Give each one a compact, unique
  // nook while keeping it off the 32-scene backbone.
  const side = echoIndex % 2 === 0 ? -1 : 1;
  const ring = Math.floor(echoIndex / 2);
  const heading = scene.anchor.headingRadians + side * (Math.PI * 0.5 - ring * 0.18);
  const direction = directionForHeading(heading);
  const distance = 4.8 + ring * 2.4;
  return point3(
    scene.anchor.position[0] + direction[0] * distance,
    scene.anchor.position[1],
    scene.anchor.position[2] + direction[1] * distance,
  );
}

export const JOURNEY_ENTRY_WORLD_PLACEMENTS: readonly JourneyEntryWorldPlacement[] = journeyScenes.flatMap(
  (narrativeScene) => {
    const scene = SCENE_LAYOUT_BY_ID.get(narrativeScene.id);
    if (!scene) throw new Error(`Missing authored world layout for ${narrativeScene.id}`);
    return narrativeScene.entryIds.map((entryId) => {
      const context = JOURNEY_ENTRY_CONTEXT[entryId];
      if (!context) throw new Error(`Missing narrative context for ${entryId}`);
      const echoIndex = narrativeScene.echoEntryIds.indexOf(entryId);
      const position = context.role === "keystone"
        ? scene.anchor.position
        : echoWorldPosition(scene, echoIndex, narrativeScene.echoEntryIds.length);
      return {
        entryId,
        sceneId: scene.id,
        role: context.role,
        position,
        clearingRadius: context.role === "keystone" ? sceneClearingRadius(scene) : 3.6,
        elevated: position[1] > 0.5,
      } satisfies JourneyEntryWorldPlacement;
    });
  },
);

const ENTRY_WORLD_PLACEMENT_BY_ID = new Map(
  JOURNEY_ENTRY_WORLD_PLACEMENTS.map((placement) => [placement.entryId, placement] as const),
);

export function getJourneyEntryWorldPlacement(entryId: string) {
  return ENTRY_WORLD_PLACEMENT_BY_ID.get(entryId);
}

export function getJourneyEntryWorldPosition(entryId: string): WorldPoint3 | undefined {
  return ENTRY_WORLD_PLACEMENT_BY_ID.get(entryId)?.position;
}

export function getJourneyEntryClearingRadius(entryId: string) {
  return ENTRY_WORLD_PLACEMENT_BY_ID.get(entryId)?.clearingRadius;
}

export function getJourneyEntryBiome(entryId: string): TechnicalBiome | undefined {
  const placement = ENTRY_WORLD_PLACEMENT_BY_ID.get(entryId);
  return placement ? SCENE_LAYOUT_BY_ID.get(placement.sceneId)?.biome : undefined;
}

export function isJourneyEntryElevated(entryId: string) {
  return ENTRY_WORLD_PLACEMENT_BY_ID.get(entryId)?.elevated ?? false;
}

export const JOURNEY_WORLD_LAYOUT: JourneyWorldLayout = {
  version: 1,
  coordinateSystem: {
    units: "meters",
    upAxis: "y",
    routeForwardAxis: "positive-z",
  },
  chapters: JOURNEY_CHAPTER_LAYOUTS,
  scenes: JOURNEY_SCENE_LAYOUTS,
  mainRoute: JOURNEY_MAIN_ROUTE,
  proceduralTreeExclusions: PROCEDURAL_TREE_EXCLUSION_VOLUMES,
  echoSpurAttachments: ECHO_SPUR_ATTACHMENTS,
};

const SCENE_ID_SET = new Set<string>(JOURNEY_SCENE_IDS);

export function isJourneySceneId(value: string): value is JourneySceneId {
  return SCENE_ID_SET.has(value);
}

export function getJourneySceneLayout(sceneId: JourneySceneId): JourneySceneLayout {
  const scene = SCENE_LAYOUT_BY_ID.get(sceneId);
  if (!scene) throw new RangeError(`Unknown journey scene: ${sceneId}`);
  return scene;
}

/**
 * Returns the local-space heading from a scene's anchor toward the route entry.
 * Authored props can use this frame to face the arriving player while world
 * interaction targets stay aligned with those visibly rotated props.
 */
export function getJourneySceneArrivalHeading(sceneId: JourneySceneId) {
  const scene = getJourneySceneLayout(sceneId);
  const entryGateway = scene.gateways.find(
    (gateway) => gateway.role === "entry" || gateway.role === "origin",
  );
  if (!entryGateway) return 0;
  const worldHeading = Math.atan2(
    entryGateway.position[0] - scene.anchor.position[0],
    entryGateway.position[2] - scene.anchor.position[2],
  );
  const localHeading = worldHeading - scene.anchor.headingRadians;
  return Math.atan2(Math.sin(localHeading), Math.cos(localHeading));
}

/**
 * Resolves the only heavyweight scene plus the immediate route neighbors that
 * may render as lightweight transition proxies. Persistent landmarks are a
 * separate concern and should never be promoted to full scene renders here.
 */
export function resolveJourneyRenderWindow(sceneId: JourneySceneId): JourneyRenderWindow {
  const activeIndex = JOURNEY_SCENE_LAYOUTS.findIndex((scene) => scene.id === sceneId);
  if (activeIndex < 0) throw new RangeError(`Unknown journey scene: ${sceneId}`);

  const entries: JourneyRenderWindowEntry[] = [];
  const previous = JOURNEY_SCENE_LAYOUTS[activeIndex - 1];
  const active = JOURNEY_SCENE_LAYOUTS[activeIndex];
  const next = JOURNEY_SCENE_LAYOUTS[activeIndex + 1];
  if (previous) entries.push({ sceneId: previous.id, mode: "adjacent", routeOffset: -1 });
  entries.push({ sceneId: active.id, mode: "active", routeOffset: 0 });
  if (next) entries.push({ sceneId: next.id, mode: "adjacent", routeOffset: 1 });

  return {
    activeSceneId: active.id,
    activeSceneIds: [active.id],
    adjacentSceneIds: entries
      .filter((entry) => entry.mode === "adjacent")
      .map((entry) => entry.sceneId),
    entries,
  };
}

function isFinitePoint(point: readonly number[], dimensions: number) {
  return point.length === dimensions && point.every(Number.isFinite);
}

function pointInsideBounds(point: WorldPoint3, bounds: JourneySceneBounds) {
  return point.every((value, axis) => value >= bounds.min[axis] && value <= bounds.max[axis]);
}

export function validateJourneyWorldLayout(
  layout: JourneyWorldLayout = JOURNEY_WORLD_LAYOUT,
): JourneyWorldLayoutValidationIssue[] {
  const issues: JourneyWorldLayoutValidationIssue[] = [];
  const add = (code: string, message: string) => issues.push({ code, message });
  const chapterIds = new Set(layout.chapters.map((chapter) => chapter.id));
  const sceneIds = new Set(layout.scenes.map((scene) => scene.id));
  const chapterById = new Map(layout.chapters.map((chapter) => [chapter.id, chapter] as const));
  const sceneById = new Map(layout.scenes.map((scene) => [scene.id, scene] as const));

  if (layout.chapters.length !== NARRATIVE_CHAPTER_IDS.length) {
    add("chapter.count", `Expected ${NARRATIVE_CHAPTER_IDS.length} chapters, received ${layout.chapters.length}.`);
  }
  if (chapterIds.size !== layout.chapters.length) add("chapter.id.duplicate", "Chapter IDs must be unique.");
  if (layout.scenes.length !== JOURNEY_SCENE_IDS.length) {
    add("scene.count", `Expected ${JOURNEY_SCENE_IDS.length} scenes, received ${layout.scenes.length}.`);
  }
  if (sceneIds.size !== layout.scenes.length) add("scene.id.duplicate", "Scene IDs must be unique.");

  NARRATIVE_CHAPTER_IDS.forEach((chapterId, index) => {
    if (layout.chapters[index]?.id !== chapterId) {
      add("chapter.order", `Chapter ${index} must be ${chapterId}.`);
    }
  });
  JOURNEY_SCENE_IDS.forEach((sceneId, index) => {
    if (layout.scenes[index]?.id !== sceneId) add("scene.order", `Scene ${index} must be ${sceneId}.`);
  });

  layout.chapters.forEach((chapter, index) => {
    if (chapter.order !== index) add("chapter.order-index", `${chapter.id} has an invalid order index.`);
    if (!TECHNICAL_BIOMES.includes(chapter.biome)) add("chapter.biome", `${chapter.id} has an unknown biome.`);
    if (!sceneIds.has(chapter.anchorSceneId)) {
      add("chapter.anchor.missing", `${chapter.id} references missing anchor scene ${chapter.anchorSceneId}.`);
    }
    if (!isFinitePoint(chapter.anchor.position, 3) || !Number.isFinite(chapter.anchor.headingRadians)) {
      add("chapter.anchor.invalid", `${chapter.id} has a non-finite anchor.`);
    }
    const actualSceneIds = layout.scenes
      .filter((scene) => scene.chapterId === chapter.id)
      .map((scene) => scene.id);
    if (chapter.sceneIds.join("|") !== actualSceneIds.join("|")) {
      add("chapter.scenes", `${chapter.id} scene membership or order is inconsistent.`);
    }
  });

  layout.scenes.forEach((scene, index) => {
    if (scene.order !== index) add("scene.order-index", `${scene.id} has an invalid order index.`);
    const chapter = chapterById.get(scene.chapterId);
    if (!chapter) add("scene.chapter.unknown", `${scene.id} references unknown chapter ${scene.chapterId}.`);
    else if (chapter.biome !== scene.biome) add("scene.biome", `${scene.id} does not match its chapter biome.`);
    if (!isFinitePoint(scene.anchor.position, 3) || !Number.isFinite(scene.anchor.headingRadians)) {
      add("scene.anchor.invalid", `${scene.id} has a non-finite anchor.`);
    }
    if (!isFinitePoint(scene.bounds.min, 3) || !isFinitePoint(scene.bounds.max, 3)) {
      add("scene.bounds.invalid", `${scene.id} has non-finite bounds.`);
    } else {
      if (scene.bounds.min.some((value, axis) => value >= scene.bounds.max[axis])) {
        add("scene.bounds.empty", `${scene.id} bounds must have positive volume.`);
      }
      if (!pointInsideBounds(scene.anchor.position, scene.bounds)) {
        add("scene.anchor.outside-bounds", `${scene.id} anchor lies outside its bounds.`);
      }
    }
    if (scene.gateways.length !== 2) add("scene.gateway.count", `${scene.id} must define entry and exit gateways.`);
    const gatewayIds = new Set(scene.gateways.map((gateway) => gateway.id));
    if (gatewayIds.size !== scene.gateways.length) add("scene.gateway.duplicate", `${scene.id} gateway IDs must be unique.`);
    scene.gateways.forEach((gateway) => {
      if (!isFinitePoint(gateway.position, 3)) add("scene.gateway.invalid", `${gateway.id} has a non-finite position.`);
      else if (!pointInsideBounds(gateway.position, scene.bounds)) {
        add("scene.gateway.outside-bounds", `${gateway.id} lies outside ${scene.id} bounds.`);
      }
      if (gateway.connectsToSceneId && !sceneIds.has(gateway.connectsToSceneId)) {
        add("scene.gateway.target", `${gateway.id} references an unknown scene.`);
      }
    });
  });

  if (layout.mainRoute.length !== Math.max(0, layout.scenes.length - 1)) {
    add("route.count", "The primary route must connect every consecutive scene exactly once.");
  }
  const routeIds = new Set<string>();
  layout.mainRoute.forEach((segment, index) => {
    if (routeIds.has(segment.id)) add("route.id.duplicate", `Duplicate route ID ${segment.id}.`);
    routeIds.add(segment.id);
    const expectedSource = layout.scenes[index];
    const expectedTarget = layout.scenes[index + 1];
    if (segment.order !== index) add("route.order-index", `${segment.id} has an invalid order index.`);
    if (segment.fromSceneId !== expectedSource?.id || segment.toSceneId !== expectedTarget?.id) {
      add("route.sequence", `${segment.id} does not connect consecutive authored scenes.`);
    }
    const source = sceneById.get(segment.fromSceneId);
    const target = sceneById.get(segment.toSceneId);
    if (!source || !target) add("route.scene.unknown", `${segment.id} references an unknown scene.`);
    else {
      if (!source.gateways.some((gateway) => gateway.id === segment.fromGatewayId)) {
        add("route.gateway.source", `${segment.id} references an unknown source gateway.`);
      }
      if (!target.gateways.some((gateway) => gateway.id === segment.toGatewayId)) {
        add("route.gateway.target", `${segment.id} references an unknown target gateway.`);
      }
    }
  });

  const exclusionIds = new Set<string>();
  const coreExclusionSceneIds = new Set<JourneySceneId>();
  layout.proceduralTreeExclusions.forEach((volume) => {
    if (exclusionIds.has(volume.id)) add("tree-exclusion.id.duplicate", `Duplicate exclusion ID ${volume.id}.`);
    exclusionIds.add(volume.id);
    if (volume.sceneIds.length === 0 || volume.sceneIds.some((sceneId) => !sceneIds.has(sceneId))) {
      add("tree-exclusion.scene", `${volume.id} must reference known scenes.`);
    }
    if (volume.id.endsWith(".core") && volume.sceneIds.length === 1) {
      coreExclusionSceneIds.add(volume.sceneIds[0]);
    }
    if (volume.kind === "box") {
      if (!isFinitePoint(volume.center, 3) || !isFinitePoint(volume.halfExtents, 3)) {
        add("tree-exclusion.geometry", `${volume.id} has invalid box geometry.`);
      } else if (volume.halfExtents.some((value) => value <= 0)) {
        add("tree-exclusion.size", `${volume.id} must have positive half extents.`);
      }
    } else if (volume.kind === "cylinder") {
      if (!isFinitePoint(volume.center, 3) || volume.radius <= 0 || volume.halfHeight <= 0) {
        add("tree-exclusion.geometry", `${volume.id} has invalid cylinder geometry.`);
      }
    } else if (
      !isFinitePoint(volume.start, 3) ||
      !isFinitePoint(volume.end, 3) ||
      volume.radius <= 0 ||
      volume.halfHeight <= 0
    ) {
      add("tree-exclusion.geometry", `${volume.id} has invalid corridor geometry.`);
    }
  });
  layout.scenes.forEach((scene) => {
    if (!coreExclusionSceneIds.has(scene.id)) {
      add("tree-exclusion.core-missing", `${scene.id} needs a core procedural-tree exclusion.`);
    }
  });

  const spurIds = new Set<string>();
  layout.echoSpurAttachments.forEach((spur) => {
    if (spurIds.has(spur.id)) add("echo-spur.id.duplicate", `Duplicate echo-spur ID ${spur.id}.`);
    spurIds.add(spur.id);
    const scene = sceneById.get(spur.sceneId);
    if (!scene) add("echo-spur.scene", `${spur.id} references an unknown scene.`);
    else if (!pointInsideBounds(spur.attachmentPosition, scene.bounds)) {
      add("echo-spur.outside-bounds", `${spur.id} attachment lies outside ${spur.sceneId}.`);
    }
    if (
      !isFinitePoint(spur.attachmentPosition, 3) ||
      !Number.isFinite(spur.headingRadians) ||
      spur.length <= 0 ||
      spur.width <= 0 ||
      !Number.isInteger(spur.maxEchoes) ||
      spur.maxEchoes <= 0
    ) {
      add("echo-spur.geometry", `${spur.id} has invalid attachment metadata.`);
    }
  });

  return issues;
}

export function assertValidJourneyWorldLayout(
  layout: JourneyWorldLayout = JOURNEY_WORLD_LAYOUT,
): void {
  const issues = validateJourneyWorldLayout(layout);
  if (issues.length === 0) return;
  throw new Error(
    `Invalid journey world layout:\n${issues.map((issue) => `- [${issue.code}] ${issue.message}`).join("\n")}`,
  );
}
