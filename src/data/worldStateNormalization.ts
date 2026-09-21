import type {
  PortalLocation,
  Slipper3DEntry,
  Slipper3DVisual,
  SlipperEntry3DMeta,
  Vector3Tuple,
} from "./slipper3dTypes";

type JsonRecord = Record<string, unknown>;

export type NormalizedGeneratedWorldState = {
  entries: Slipper3DEntry[];
  visuals: Slipper3DVisual[];
  generatedAt?: string;
  version?: number;
  stats?: Record<string, unknown>;
};

const SCENE_KINDS = ["clearing", "mirror", "house", "archive", "river", "crown", "threshold", "wood"] as const;
const EMOTIONAL_TONES = ["grief", "return", "threshold", "fire", "water", "silence", "memory", "revelation"] as const;
const SPATIAL_ROLES = ["entrance", "memory", "trial", "revelation", "exit", "crossing"] as const;
const PORTAL_KINDS = ["tag", "chapter", "entry", "visual"] as const;
const VISUAL_ORIENTATIONS = ["portrait", "landscape", "square"] as const;
const ENVIRONMENT_KINDS = ["equirectangular", "flat-panorama", "portrait-plane", "square-plane", "shrine-plane"] as const;

function isJsonRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function recordValue(value: unknown, label: string): JsonRecord {
  if (!isJsonRecord(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function optionalRecord(value: unknown): JsonRecord | undefined {
  return isJsonRecord(value) ? value : undefined;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function optionalFiniteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function requiredStringArray(value: unknown, label: string) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`${label} must be an array of strings.`);
  }
  return value.filter((item): item is string => typeof item === "string");
}

function optionalStringArray(value: unknown) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) return undefined;
  return value.filter((item): item is string => typeof item === "string");
}

function vector3(value: unknown): Vector3Tuple | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 3 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1]) ||
    typeof value[2] !== "number" ||
    !Number.isFinite(value[2])
  ) {
    return undefined;
  }
  return [value[0], value[1], value[2]];
}

function vector2(value: unknown): [number, number] | undefined {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    typeof value[0] !== "number" ||
    !Number.isFinite(value[0]) ||
    typeof value[1] !== "number" ||
    !Number.isFinite(value[1])
  ) {
    return undefined;
  }
  return [value[0], value[1]];
}

function gradient(value: unknown): [string, string, string?] | undefined {
  if (
    !Array.isArray(value) ||
    (value.length !== 2 && value.length !== 3) ||
    typeof value[0] !== "string" ||
    typeof value[1] !== "string" ||
    (value.length === 3 && typeof value[2] !== "string")
  ) {
    return undefined;
  }
  return value.length === 3 ? [value[0], value[1], value[2]] : [value[0], value[1]];
}

function enumValue<const T extends readonly string[]>(values: T, value: unknown): T[number] | undefined {
  if (typeof value !== "string") return undefined;
  return values.find((candidate) => candidate === value);
}

function normalizePortal(value: unknown, entryId: string, index: number): PortalLocation {
  const portal = recordValue(value, `Portal ${index + 1} for entry ${entryId}`);
  const kind = enumValue(PORTAL_KINDS, portal.kind);
  const position = vector3(portal.position);
  if (!kind) throw new Error(`Portal ${index + 1} for entry ${entryId} has an invalid kind.`);
  if (!position) throw new Error(`Portal ${index + 1} for entry ${entryId} has an invalid position.`);

  const normalized: PortalLocation = {
    id: requiredString(portal.id, `Portal ${index + 1} id for entry ${entryId}`),
    label: requiredString(portal.label, `Portal ${index + 1} label for entry ${entryId}`),
    kind,
    position,
  };
  const rotation = vector3(portal.rotation);
  const strength = optionalFiniteNumber(portal.strength);
  const tag = optionalString(portal.tag);
  const targetEntryId = optionalString(portal.targetEntryId);
  const targetChapter = optionalString(portal.targetChapter);
  const color = optionalString(portal.color);
  const description = optionalString(portal.description);
  if (rotation) normalized.rotation = rotation;
  if (strength !== undefined) normalized.strength = strength;
  if (tag) normalized.tag = tag;
  if (targetEntryId) normalized.targetEntryId = targetEntryId;
  if (targetChapter) normalized.targetChapter = targetChapter;
  if (color) normalized.color = color;
  if (description) normalized.description = description;
  return normalized;
}

function normalizeEngine3d(
  rawEngine3d: JsonRecord,
  linkedVisualId: string,
  legacyMood: string | undefined,
  entryId: string,
): SlipperEntry3DMeta {
  const normalized: SlipperEntry3DMeta = { linkedVisualId };
  const environmentRadius = optionalFiniteNumber(rawEngine3d.environmentRadius);
  const cameraStart = vector3(rawEngine3d.cameraStart);
  const cameraTarget = vector3(rawEngine3d.cameraTarget);
  const cameraFov = optionalFiniteNumber(rawEngine3d.cameraFov);
  const textPosition = vector3(rawEngine3d.textPosition);
  const textRotation = vector3(rawEngine3d.textRotation);
  const textMaxWidth = optionalFiniteNumber(rawEngine3d.textMaxWidth);
  const textDistanceFactor = optionalFiniteNumber(rawEngine3d.textDistanceFactor);
  const mood = optionalString(rawEngine3d.mood) ?? legacyMood;
  const sceneKind = enumValue(SCENE_KINDS, rawEngine3d.sceneKind);
  const emotionalTone = enumValue(EMOTIONAL_TONES, rawEngine3d.emotionalTone);
  const spatialRole = enumValue(SPATIAL_ROLES, rawEngine3d.spatialRole);
  const symbolicWeight = optionalFiniteNumber(rawEngine3d.symbolicWeight);
  const environmentGradient = gradient(rawEngine3d.environmentGradient);
  const constellationPosition = vector2(rawEngine3d.constellationPosition);
  const densityMultiplier = optionalFiniteNumber(rawEngine3d.densityMultiplier);
  const worldPosition = vector3(rawEngine3d.worldPosition);

  if (environmentRadius !== undefined) normalized.environmentRadius = environmentRadius;
  if (cameraStart) normalized.cameraStart = cameraStart;
  if (cameraTarget) normalized.cameraTarget = cameraTarget;
  if (cameraFov !== undefined) normalized.cameraFov = cameraFov;
  if (textPosition) normalized.textPosition = textPosition;
  if (textRotation) normalized.textRotation = textRotation;
  if (textMaxWidth !== undefined) normalized.textMaxWidth = textMaxWidth;
  if (textDistanceFactor !== undefined) normalized.textDistanceFactor = textDistanceFactor;
  if (mood) normalized.mood = mood;
  if (sceneKind) normalized.sceneKind = sceneKind;
  if (emotionalTone) normalized.emotionalTone = emotionalTone;
  if (spatialRole) normalized.spatialRole = spatialRole;
  if (symbolicWeight === 1 || symbolicWeight === 2 || symbolicWeight === 3 || symbolicWeight === 4 || symbolicWeight === 5) {
    normalized.symbolicWeight = symbolicWeight;
  }
  if (environmentGradient) normalized.environmentGradient = environmentGradient;
  if (constellationPosition) normalized.constellationPosition = constellationPosition;
  if (densityMultiplier !== undefined) normalized.densityMultiplier = densityMultiplier;
  if (worldPosition) normalized.worldPosition = worldPosition;

  const rawAmbience = optionalRecord(rawEngine3d.ambience);
  if (rawAmbience) {
    const ambience: NonNullable<SlipperEntry3DMeta["ambience"]> = {};
    const backgroundColor = optionalString(rawAmbience.backgroundColor);
    const fogColor = optionalString(rawAmbience.fogColor);
    const fogNear = optionalFiniteNumber(rawAmbience.fogNear);
    const fogFar = optionalFiniteNumber(rawAmbience.fogFar);
    if (backgroundColor) ambience.backgroundColor = backgroundColor;
    if (fogColor) ambience.fogColor = fogColor;
    if (fogNear !== undefined) ambience.fogNear = fogNear;
    if (fogFar !== undefined) ambience.fogFar = fogFar;
    normalized.ambience = ambience;
  }

  if (rawEngine3d.portalLocations !== undefined) {
    if (!Array.isArray(rawEngine3d.portalLocations)) {
      throw new Error(`Entry ${entryId} has invalid portalLocations.`);
    }
    normalized.portalLocations = rawEngine3d.portalLocations.map((portal, index) =>
      normalizePortal(portal, entryId, index),
    );
  }

  return normalized;
}

function normalizeVisual(value: unknown, index: number): Slipper3DVisual {
  const visual = recordValue(value, `Visual ${index + 1}`);
  const orientation = enumValue(VISUAL_ORIENTATIONS, visual.orientation);
  if (!orientation) throw new Error(`Visual ${index + 1} has an invalid orientation.`);

  const src = requiredString(visual.src, `Visual ${index + 1} src`);
  if (!src.startsWith("/")) throw new Error(`Visual ${index + 1} src must be an absolute public path.`);

  const normalized: Slipper3DVisual = {
    id: requiredString(visual.id, `Visual ${index + 1} id`),
    src,
    orientation,
  };
  const alt = optionalString(visual.alt);
  const chapter = optionalString(visual.chapter);
  const tags = optionalStringArray(visual.tags);
  const environmentKind = enumValue(ENVIRONMENT_KINDS, visual.environmentKind);
  const environmentIntensity = optionalFiniteNumber(visual.environmentIntensity);
  if (alt) normalized.alt = alt;
  if (chapter) normalized.chapter = chapter;
  if (tags) normalized.tags = tags;
  if (environmentKind) normalized.environmentKind = environmentKind;
  if (environmentIntensity !== undefined) normalized.environmentIntensity = environmentIntensity;
  return normalized;
}

function normalizeEntry(value: unknown, index: number, visualIds: Set<string>): Slipper3DEntry {
  const entry = recordValue(value, `Entry ${index + 1}`);
  const entryId = requiredString(entry.id, `Entry ${index + 1} id`);
  const rawEngine3d = optionalRecord(entry.engine3d) ?? {};
  const nestedVisualId = optionalString(rawEngine3d.linkedVisualId);
  const legacyVisualId =
    optionalString(entry.linkedVisualId) ??
    optionalString(entry.visualId) ??
    optionalString(entry.heroVisualId);

  if (nestedVisualId && legacyVisualId && nestedVisualId !== legacyVisualId) {
    throw new Error(
      `Entry ${entryId} has conflicting visual references (${nestedVisualId} and ${legacyVisualId}).`,
    );
  }

  const linkedVisualId = nestedVisualId ?? legacyVisualId;
  if (!linkedVisualId) throw new Error(`Entry ${entryId} has no linked visual.`);
  if (!visualIds.has(linkedVisualId)) {
    throw new Error(`Entry ${entryId} references missing visual ${linkedVisualId}.`);
  }

  const normalized: Slipper3DEntry = {
    id: entryId,
    title: requiredString(entry.title, `Entry ${entryId} title`),
    chapter: requiredString(entry.chapter, `Entry ${entryId} chapter`),
    tags: requiredStringArray(entry.tags, `Entry ${entryId} tags`),
    body: requiredString(entry.body, `Entry ${entryId} body`),
    paragraphs: requiredStringArray(entry.paragraphs, `Entry ${entryId} paragraphs`),
    engine3d: normalizeEngine3d(
      rawEngine3d,
      linkedVisualId,
      optionalString(entry.mood),
      entryId,
    ),
  };

  const date = optionalString(entry.date);
  const sequence = optionalFiniteNumber(entry.sequence);
  const mood = optionalString(entry.mood);
  const excerpt = optionalString(entry.excerpt);
  if (date) normalized.date = date;
  if (sequence !== undefined) normalized.sequence = sequence;
  if (mood) normalized.mood = mood;
  if (excerpt) normalized.excerpt = excerpt;
  return normalized;
}

export function normalizeGeneratedWorldState(value: unknown): NormalizedGeneratedWorldState {
  const world = recordValue(value, "Generated world state");
  if (!Array.isArray(world.visuals)) throw new Error("Generated world state visuals must be an array.");
  if (!Array.isArray(world.entries)) throw new Error("Generated world state entries must be an array.");

  const visuals = world.visuals.map(normalizeVisual);
  const visualIds = new Set(visuals.map((visual) => visual.id));
  if (visualIds.size !== visuals.length) throw new Error("Generated world state contains duplicate visual IDs.");

  const entries = world.entries.map((entry, index) => normalizeEntry(entry, index, visualIds));
  const entryIds = new Set(entries.map((entry) => entry.id));
  if (entryIds.size !== entries.length) throw new Error("Generated world state contains duplicate entry IDs.");

  const generatedAt = optionalString(world.generatedAt);
  const version = optionalFiniteNumber(world.version);
  const stats = optionalRecord(world.stats);
  return {
    entries,
    visuals,
    ...(generatedAt ? { generatedAt } : {}),
    ...(version !== undefined ? { version } : {}),
    ...(stats ? { stats: { ...stats } } : {}),
  };
}
