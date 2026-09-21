export type ThornedHouseStage = "garden" | "bedroom" | "leaving";
export type ThornedHouseExitStage = "sealed" | "glimpsed" | "open";
export type ThornedHousePoint3 = [number, number, number];

export type ThornedHouseColliderRole =
  | "shell-wall"
  | "room-wall"
  | "corridor-frame"
  | "memory-surface"
  | "memory-clutter"
  | "bedroom-furniture"
  | "garden-door"
  | "exit-door";

export type ThornedHouseColliderSpec = {
  id: string;
  role: ThornedHouseColliderRole;
  args: ThornedHousePoint3;
  position: ThornedHousePoint3;
  rotation?: ThornedHousePoint3;
};

/**
 * The collider set is deliberately finite. It covers only authored solid
 * architecture and player-height clutter; decorative thorns, candles, roof
 * trim, and wall memories stay visual-only.
 */
export const THORNED_HOUSE_COLLIDER_BUDGET = 64;
export const THORNED_HOUSE_SAFE_ROUTE_HALF_WIDTH = 0.68;

export const THORNED_HOUSE_ROOM_MODULES = [
  { z: -2.2, width: 10.8, height: 4.9, offset: 0 },
  { z: -0.35, width: 9.7, height: 4.55, offset: -0.18 },
  { z: 1.5, width: 8.7, height: 4.2, offset: 0.22 },
  { z: 3.25, width: 7.8, height: 3.85, offset: -0.3 },
  { z: 4.85, width: 6.9, height: 3.55, offset: 0.26 },
  { z: 6.2, width: 6.1, height: 3.3, offset: -0.18 },
  { z: 7.35, width: 5.5, height: 3.12, offset: 0 },
] as const;

export const THORNED_HOUSE_MEMORY_SURFACES = [
  { position: [-3.7, 0.72, -0.8] as ThornedHousePoint3, size: [2.9, 0.18, 1.35] as ThornedHousePoint3 },
  { position: [3.15, 1.14, 1.05] as ThornedHousePoint3, size: [2.15, 0.18, 0.72] as ThornedHousePoint3 },
  { position: [-2.35, 0.94, 3.25] as ThornedHousePoint3, size: [1.75, 0.16, 0.82] as ThornedHousePoint3 },
  { position: [2.15, 0.58, 4.72] as ThornedHousePoint3, size: [2.45, 0.16, 1.15] as ThornedHousePoint3 },
] as const;

export const THORNED_HOUSE_MEMORY_OBJECTS = [
  [-4.42, 1.03, -1.02, 0.48, 0.48, 0.38],
  [-3.88, 1.08, -0.7, 0.32, 0.64, 0.3],
  [-3.3, 1.02, -1.0, 0.58, 0.42, 0.45],
  [-2.9, 1.1, -0.64, 0.24, 0.7, 0.24],
  [2.55, 1.42, 0.9, 0.36, 0.48, 0.3],
  [3.08, 1.4, 1.16, 0.54, 0.42, 0.32],
  [3.64, 1.52, 0.9, 0.3, 0.72, 0.26],
  [-2.82, 1.18, 3.12, 0.48, 0.34, 0.45],
  [-2.27, 1.25, 3.42, 0.3, 0.48, 0.24],
  [-1.88, 1.2, 3.08, 0.38, 0.38, 0.3],
  [1.34, 0.86, 4.45, 0.52, 0.52, 0.42],
  [1.88, 0.92, 4.92, 0.4, 0.68, 0.32],
  [2.35, 0.86, 4.5, 0.66, 0.48, 0.46],
  [2.94, 0.88, 4.94, 0.34, 0.54, 0.28],
  [-0.82, 0.28, 2.18, 0.74, 0.5, 0.86],
  [0.78, 0.22, 2.86, 0.62, 0.4, 0.7],
  [-0.46, 0.25, 4.14, 0.58, 0.44, 0.64],
  [0.68, 0.32, 5.32, 0.68, 0.6, 0.76],
  [-1.18, 0.24, 5.85, 0.52, 0.44, 0.72],
  [1.32, 0.2, 6.12, 0.58, 0.36, 0.62],
] as const;

export function thornedHouseRoomCount(detail: number, reducedEffects: boolean) {
  return reducedEffects ? 5 : Math.min(7, 5 + Math.max(0, detail - 1));
}

export function thornedHouseCorridorCount(detail: number, reducedEffects: boolean) {
  return reducedEffects ? 4 : Math.min(THORNED_HOUSE_ROOM_MODULES.length, 4 + detail);
}

export function thornedHouseSurfaceCount(
  stage: ThornedHouseStage,
  reducedEffects: boolean,
) {
  return reducedEffects ? 2 : stage === "garden" ? 3 : 4;
}

export function thornedHouseClutterCount({
  stage,
  detail,
  reducedEffects,
  cleared,
  refilled,
}: {
  stage: ThornedHouseStage;
  detail: number;
  reducedEffects: boolean;
  cleared: boolean;
  refilled: boolean;
}) {
  const clearedBeforeRefill = stage === "garden" && cleared && !refilled;
  const desired = clearedBeforeRefill
    ? 2
    : stage === "garden"
      ? 7 + detail
      : stage === "bedroom"
        ? 15 + detail * 2
        : 12 + detail;
  return Math.min(
    THORNED_HOUSE_MEMORY_OBJECTS.length,
    reducedEffects ? Math.min(9, desired) : desired,
  );
}

export function thornedHouseClutterTransform(
  index: number,
  stage: ThornedHouseStage,
  reorganisationReleased: boolean,
) {
  const source = THORNED_HOUSE_MEMORY_OBJECTS[index];
  if (!source) return null;
  const opensPath = (stage === "leaving" || reorganisationReleased) && index >= 14;
  const side = Math.sign(source[0] || (index % 2 ? 1 : -1));
  return {
    position: [
      source[0] + (opensPath ? side * 1.8 : 0),
      source[1],
      source[2],
    ] as ThornedHousePoint3,
    rotation: [index * 0.13, index * 0.73, index * 0.08] as ThornedHousePoint3,
    size: [source[3], source[4], source[5]] as ThornedHousePoint3,
  };
}

function collider(
  id: string,
  role: ThornedHouseColliderRole,
  args: ThornedHousePoint3,
  position: ThornedHousePoint3,
  rotation?: ThornedHousePoint3,
): ThornedHouseColliderSpec {
  return { id, role, args, position, ...(rotation ? { rotation } : {}) };
}

/**
 * Builds the fixed Rapier cuboids from the same dimensions used by the visible
 * house. The central route deliberately remains wider than the player capsule;
 * the final action moves centre clutter outward and removes the exit slab.
 */
export function resolveThornedHouseColliderLayout({
  stage,
  exitStage,
  detail,
  reducedEffects,
  shellSize,
  cleared,
  refilled,
  reorganisationReleased,
}: {
  stage: ThornedHouseStage;
  exitStage: ThornedHouseExitStage;
  detail: number;
  reducedEffects: boolean;
  shellSize: ThornedHousePoint3;
  cleared: boolean;
  refilled: boolean;
  reorganisationReleased: boolean;
}) {
  const specs: ThornedHouseColliderSpec[] = [];
  const [shellWidth, shellHeight, shellDepth] = shellSize;
  const shellCenterZ = 2.35;
  const wallHalfThickness = 0.175;
  const exitGapWidth = 4.6;
  const backSegmentWidth = (shellWidth - exitGapWidth) * 0.5;
  const backSegmentCenterX = (shellWidth + exitGapWidth) * 0.25;

  specs.push(
    collider(
      "shell-left",
      "shell-wall",
      [wallHalfThickness, shellHeight * 0.5, shellDepth * 0.5],
      [-shellWidth * 0.5, shellHeight * 0.5, shellCenterZ],
    ),
    collider(
      "shell-right",
      "shell-wall",
      [wallHalfThickness, shellHeight * 0.5, shellDepth * 0.5],
      [shellWidth * 0.5, shellHeight * 0.5, shellCenterZ],
    ),
    collider(
      "shell-back-left",
      "shell-wall",
      [backSegmentWidth * 0.5, shellHeight * 0.5, wallHalfThickness],
      [-backSegmentCenterX, shellHeight * 0.5, shellCenterZ + shellDepth * 0.5],
    ),
    collider(
      "shell-back-right",
      "shell-wall",
      [backSegmentWidth * 0.5, shellHeight * 0.5, wallHalfThickness],
      [backSegmentCenterX, shellHeight * 0.5, shellCenterZ + shellDepth * 0.5],
    ),
  );

  const roomCount = thornedHouseRoomCount(detail, reducedEffects);
  const compression = stage === "bedroom" ? 1 : stage === "garden" ? 0.42 : 0.68;
  THORNED_HOUSE_ROOM_MODULES.slice(0, roomCount).forEach((room, index) => {
    const width = room.width - compression * index * 0.22;
    const height = room.height - compression * index * 0.1;
    const sideDepth = index === 0 ? 1.65 : 1.2;
    const centerX = room.offset * compression;
    specs.push(
      collider(
        `room-${index}-left`,
        "room-wall",
        [0.13, height * 0.5, sideDepth * 0.5],
        [centerX - width * 0.5, height * 0.5, room.z],
      ),
      collider(
        `room-${index}-right`,
        "room-wall",
        [0.13, height * 0.5, sideDepth * 0.5],
        [centerX + width * 0.5, height * 0.5, room.z],
      ),
    );
  });

  const corridorCount = thornedHouseCorridorCount(detail, reducedEffects);
  const compressed = stage === "bedroom";
  THORNED_HOUSE_ROOM_MODULES.slice(0, corridorCount).forEach((_, index) => {
    const progress = corridorCount <= 1 ? 0 : index / (corridorCount - 1);
    const narrowing = compressed
      ? progress * 1.12
      : stage === "leaving"
        ? -progress * 0.3
        : progress * 0.38;
    const width = 3.7 - narrowing;
    const height = 4.25 - Math.max(0, narrowing) * 0.62;
    const centerX = Math.sin(index * 1.7) * (compressed ? 0.18 : 0.08);
    const z = -1.65 + index * 1.52;
    specs.push(
      collider(
        `corridor-${index}-left`,
        "corridor-frame",
        [0.21, height * 0.5, 0.15],
        [centerX - width * 0.5, height * 0.5, z],
      ),
      collider(
        `corridor-${index}-right`,
        "corridor-frame",
        [0.21, height * 0.5, 0.15],
        [centerX + width * 0.5, height * 0.5, z],
      ),
    );
  });

  const surfaceCount = thornedHouseSurfaceCount(stage, reducedEffects);
  THORNED_HOUSE_MEMORY_SURFACES.slice(0, surfaceCount).forEach((surface, index) => {
    specs.push(
      collider(
        `surface-${index}`,
        "memory-surface",
        [surface.size[0] * 0.5, surface.size[1] * 0.5, surface.size[2] * 0.5],
        [...surface.position],
      ),
    );
  });

  if (stage === "bedroom") {
    specs.push(
      collider(
        "old-memory-bed",
        "bedroom-furniture",
        [2.025, 0.42, 1.31],
        [-3.22, 0.78, 2.72],
      ),
    );
  }

  if (stage === "garden") {
    specs.push(
      collider(
        "locked-garden-door",
        "garden-door",
        [1.94, 2.275, 0.1],
        [0, 2.424, -3.58],
      ),
    );
  }

  if (exitStage !== "open") {
    const openAmount = exitStage === "glimpsed" ? 0.24 : 0;
    specs.push(
      collider(
        `exit-${exitStage}`,
        "exit-door",
        [1.72, 2.17, 0.1],
        [
          -1.72 + Math.cos(openAmount) * 1.72,
          2.18,
          7.25 + Math.sin(openAmount) * 1.72,
        ],
        [0, -openAmount, 0],
      ),
    );
  }

  const clutterCount = thornedHouseClutterCount({
    stage,
    detail,
    reducedEffects,
    cleared,
    refilled,
  });
  const remainingBudget = Math.max(0, THORNED_HOUSE_COLLIDER_BUDGET - specs.length);
  for (let index = 0; index < Math.min(clutterCount, remainingBudget); index += 1) {
    const transform = thornedHouseClutterTransform(index, stage, reorganisationReleased);
    if (!transform) continue;
    specs.push(
      collider(
        `clutter-${index}`,
        "memory-clutter",
        [transform.size[0] * 0.5, transform.size[1] * 0.5, transform.size[2] * 0.5],
        transform.position,
        transform.rotation,
      ),
    );
  }

  return specs;
}
