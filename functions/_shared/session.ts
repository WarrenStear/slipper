import { sanitizeStoryEventPersistence } from "../../src/storyEvents/storyEventSchema.ts";
export type Env = {
  SIDTW_JOURNEY_KV?: KVNamespace;
  SIDTW_MAGIC_KV?: KVNamespace;
  MAGIC_LINK_SECRET?: string;
  APP_ORIGIN?: string;
  EMAIL_WEBHOOK_URL?: string;
  ENABLE_DEV_MAGIC_LINK?: string;
  SESSION_MAX_AGE_DAYS?: string;
};

export const CLOUD_JOURNEY_SCHEMA_VERSION = 2 as const;

const JOURNEY_ACT_IDS = [
  "first-wood",
  "mirror-clearing",
  "thorned-house",
  "blue-moon-archive",
  "fire-and-river",
  "crowned-return",
] as const;

const JOURNEY_CHAPTER_IDS = [
  "broken-floor",
  "enchanted-wood",
  "blue-moon-sanctuary",
  "nest",
  "sunset-seer",
  "thorned-house",
  "wolf-swan-seer",
  "fire-river",
  "fork",
  "three-climbs",
  "crowned-return",
  "lantern-epilogue",
] as const;

const JOURNEY_SCENE_IDS = [
  "broken-floor.confession",
  "enchanted.rabbit-hole",
  "enchanted.friendship-meadow",
  "enchanted.masked-hearth",
  "blue-moon.sanctuary",
  "blue-moon.intimacy",
  "blue-moon.caged-bird",
  "nest.two-hands",
  "nest.unsupported-cycle",
  "nest.protection",
  "sunset.warning-grove",
  "sunset.true-mirror",
  "sunset.stillness",
  "thorned.locked-garden",
  "thorned.old-memory-bedroom",
  "thorned.self-owned-world",
  "wolf-swan.false-choice",
  "wolf-swan.convergence",
  "fire.boundary",
  "river.wash",
  "river.release-surrender",
  "fork.weighing",
  "fork.four-verbs",
  "fork.relinquish-hope",
  "climbs.arrival",
  "climb.mind",
  "climb.heart",
  "climb.womb",
  "crowned.threshold",
  "crowned.home",
  "crowned.sovereignty",
  "epilogue.constellation",
] as const;

const LANDMARK_STATES = [
  "untouched",
  "awakened",
  "witnessed",
  "transformed",
  "scarred",
  "released",
] as const;

type JourneyActId = (typeof JOURNEY_ACT_IDS)[number];
type JourneyChapterId = (typeof JOURNEY_CHAPTER_IDS)[number];
type JourneySceneId = (typeof JOURNEY_SCENE_IDS)[number];
type LandmarkState = (typeof LANDMARK_STATES)[number];

type CloudJourneyInventory = {
  lantern: boolean;
  recoveredKeys: string[];
  symbolicObjects: string[];
};

/** Versioned, bounded story state persisted behind the signed-session boundary. */
export type CloudJourneySnapshot = {
  completedStoryEventIds: string[];
  storyObjectStates: Record<string, string>;
  storyPlacementStates: Record<string, string>;
  cloudSchemaVersion: typeof CLOUD_JOURNEY_SCHEMA_VERSION;
  migratedFromNavigation: boolean;
  schemaVersion: typeof CLOUD_JOURNEY_SCHEMA_VERSION;
  actId: JourneyActId;
  beatId: string;
  chapterId: JourneyChapterId;
  sceneId: JourneySceneId;
  activeEntryId: string;
  history: string[];
  visitedEntryIds: string[];
  witnessedEntryIds: string[];
  completedRitualIds: string[];
  worldFlags: Record<string, boolean>;
  landmarkStates: Record<string, LandmarkState>;
  resonances: { wolf: number; swan: number; seer: number };
  inventory: CloudJourneyInventory;
  releasedWords: string[];
  completedActs: JourneyActId[];
  completedChapterIds: JourneyChapterId[];
  completedSceneIds: JourneySceneId[];
  storyStarted: boolean;
  storyCompleted: boolean;
  storyStartedAt: string | null;
  storyCompletedAt: string | null;
  updatedAt: string;
};

export type JourneySnapshot = CloudJourneySnapshot;

const encoder = new TextEncoder();
const DEFAULT_SESSION_MAX_AGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
// Keep aligned with the client JOURNEY_HISTORY_LIMIT.
const MAX_HISTORY = 512;
const MAX_ENTRY_IDS = 66;
const MAX_RITUAL_IDS = 96;
const MAX_WORLD_FLAGS = 160;
const MAX_LANDMARKS = 64;
const MAX_INVENTORY_IDS = 48;
const MAX_RELEASED_WORDS = 64;
const MAX_RELEASED_WORD_LENGTH = 48;
const MAX_OPAQUE_ID_LENGTH = 96;
const OPAQUE_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]*$/;
const FRAGMENT_ID_PATTERN = /^fragment-(?:00[1-9]|0[1-5][0-9]|06[0-6])$/;
const ACT_ID_SET = new Set<string>(JOURNEY_ACT_IDS);
const CHAPTER_ID_SET = new Set<string>(JOURNEY_CHAPTER_IDS);
const SCENE_ID_SET = new Set<string>(JOURNEY_SCENE_IDS);
const LANDMARK_STATE_SET = new Set<string>(LANDMARK_STATES);

function base64Url(bytes: ArrayBuffer | Uint8Array) {
  const array = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const byte of array) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function safeJsonParse<T>(value: string): T | null {
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function resolveSessionMaxAgeMs(env: Env) {
  const configuredDays = Number(env.SESSION_MAX_AGE_DAYS ?? DEFAULT_SESSION_MAX_AGE_DAYS);
  const safeDays = Number.isFinite(configuredDays) && configuredDays > 0 ? configuredDays : DEFAULT_SESSION_MAX_AGE_DAYS;
  return safeDays * DAY_MS;
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
  return crypto.subtle.sign("HMAC", key, encoder.encode(payload));
}

export function hasPersistenceBindings(env: Env) {
  return Boolean(env.SIDTW_JOURNEY_KV && env.SIDTW_MAGIC_KV && env.MAGIC_LINK_SECRET);
}

export function isDevMagicLinkEnabled(env: Env) {
  return env.ENABLE_DEV_MAGIC_LINK === "true" || env.ENABLE_DEV_MAGIC_LINK === "1";
}

export function persistenceUnavailable() {
  return json(
    {
      error:
        "Cloud journey persistence is not configured. Add SIDTW_JOURNEY_KV, SIDTW_MAGIC_KV, and MAGIC_LINK_SECRET in Cloudflare Pages.",
    },
    503,
  );
}

export async function signSession(env: Env, subject: string) {
  if (!env.MAGIC_LINK_SECRET) throw new Error("MAGIC_LINK_SECRET is not configured.");
  const payload = base64Url(encoder.encode(JSON.stringify({ sub: subject, iat: Date.now() })));
  const signature = base64Url(await hmac(env.MAGIC_LINK_SECRET, payload));
  return `${payload}.${signature}`;
}

export async function verifySession(env: Env, token: string) {
  if (!env.MAGIC_LINK_SECRET) return null;

  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  const expected = base64Url(await hmac(env.MAGIC_LINK_SECRET, payload));
  if (expected !== signature) return null;

  const decoded = new TextDecoder().decode(fromBase64Url(payload));
  const data = safeJsonParse<{ sub?: unknown; iat?: unknown }>(decoded);
  if (!data || typeof data.sub !== "string" || typeof data.iat !== "number") return null;
  if (!Number.isFinite(data.iat) || Date.now() - data.iat > resolveSessionMaxAgeMs(env)) return null;

  return data.sub;
}

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function journeyKey(subject: string) {
  return `journey:${subject.toLowerCase()}`;
}

export async function requireSubject(request: Request, env: Env) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : "";
  if (!token) return null;
  return verifySession(env, token);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function opaqueId(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  if (
    normalized.length === 0 ||
    normalized.length > MAX_OPAQUE_ID_LENGTH ||
    !OPAQUE_ID_PATTERN.test(normalized)
  ) return null;
  return normalized;
}

function fragmentId(value: unknown) {
  const normalized = opaqueId(value);
  return normalized && FRAGMENT_ID_PATTERN.test(normalized) ? normalized : null;
}

function idFromSet<Value extends string>(value: unknown, allowed: Set<string>, fallback: Value) {
  return typeof value === "string" && allowed.has(value) ? value as Value : fallback;
}

function idArray(
  value: unknown,
  maximum: number,
  sanitizer: (candidate: unknown) => string | null = opaqueId,
  preserveDuplicates = false,
) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    const id = sanitizer(candidate);
    if (!id || (!preserveDuplicates && seen.has(id))) continue;
    seen.add(id);
    result.push(id);
    if (result.length >= maximum) break;
  }
  return result;
}

function orderedKnownIds<Value extends string>(value: unknown, ordered: readonly Value[]) {
  if (!Array.isArray(value)) return [];
  const selected = new Set(value.filter((candidate): candidate is Value =>
    typeof candidate === "string" && ordered.includes(candidate as Value),
  ));
  return ordered.filter((id) => selected.has(id));
}

function boundedInteger(value: unknown) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function booleanRecord(value: unknown, maximum: number) {
  const record = asRecord(value);
  if (!record) return {};
  const result: Record<string, boolean> = {};
  for (const [candidate, flag] of Object.entries(record)) {
    const id = opaqueId(candidate);
    if (!id || typeof flag !== "boolean") continue;
    result[id] = flag;
    if (Object.keys(result).length >= maximum) break;
  }
  return result;
}

function landmarkRecord(value: unknown) {
  const record = asRecord(value);
  if (!record) return {};
  const result: Record<string, LandmarkState> = {};
  for (const [candidate, state] of Object.entries(record)) {
    const id = opaqueId(candidate);
    if (!id || typeof state !== "string" || !LANDMARK_STATE_SET.has(state)) continue;
    result[id] = state as LandmarkState;
    if (Object.keys(result).length >= MAX_LANDMARKS) break;
  }
  return result;
}

function releasedWords(value: unknown) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const candidate of value) {
    if (typeof candidate !== "string") continue;
    const word = Array.from(
      candidate
        .normalize("NFC")
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
        .replace(/\s+/g, " ")
        .trim(),
    ).slice(0, MAX_RELEASED_WORD_LENGTH).join("");
    const identity = word.toLocaleLowerCase("en");
    if (!word || seen.has(identity)) continue;
    seen.add(identity);
    result.push(word);
    if (result.length >= MAX_RELEASED_WORDS) break;
  }
  return result;
}

function isoDate(value: unknown, fallback: string) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : fallback;
}

function nullableIsoDate(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null;
}

export function sanitizeJourney(input: unknown): JourneySnapshot | null {
  const value = asRecord(input);
  if (!value) return null;
  if (
    value.schemaVersion !== undefined &&
    value.schemaVersion !== 1 &&
    value.schemaVersion !== CLOUD_JOURNEY_SCHEMA_VERSION
  ) return null;

  const activeEntryId = fragmentId(value.activeEntryId);
  if (!activeEntryId || !Array.isArray(value.history) || !Array.isArray(value.visitedEntryIds)) return null;

  const history = idArray(value.history, MAX_HISTORY, fragmentId, true);
  const visitedEntryIds = idArray(value.visitedEntryIds, MAX_ENTRY_IDS, fragmentId);
  if (!visitedEntryIds.includes(activeEntryId)) visitedEntryIds.push(activeEntryId);
  const resonances = asRecord(value.resonances);
  const inventory = asRecord(value.inventory);
  const completedActs = orderedKnownIds(value.completedActs, JOURNEY_ACT_IDS);
  const completedChapterIds = orderedKnownIds(value.completedChapterIds, JOURNEY_CHAPTER_IDS);
  const completedSceneIds = orderedKnownIds(value.completedSceneIds, JOURNEY_SCENE_IDS);
  const allChaptersCompleted = completedChapterIds.length === JOURNEY_CHAPTER_IDS.length;
  const hasNarrativeProgress =
    activeEntryId !== "fragment-001" ||
    history.length > 0 ||
    visitedEntryIds.some((id) => id !== "fragment-001") ||
    completedSceneIds.length > 0;
  const storyCompleted = value.storyCompleted === true && allChaptersCompleted;
  const timestamp = new Date().toISOString();
  const migratedFromNavigation = value.schemaVersion === undefined &&
    value.witnessedEntryIds === undefined &&
    value.completedRitualIds === undefined &&
    value.worldFlags === undefined &&
    value.landmarkStates === undefined &&
    value.resonances === undefined &&
    value.inventory === undefined &&
    value.completedChapterIds === undefined &&
    value.completedSceneIds === undefined;

  return {
    ...sanitizeStoryEventPersistence(value),
    cloudSchemaVersion: CLOUD_JOURNEY_SCHEMA_VERSION,
    migratedFromNavigation,
    schemaVersion: CLOUD_JOURNEY_SCHEMA_VERSION,
    actId: idFromSet(value.actId, ACT_ID_SET, JOURNEY_ACT_IDS[0]),
    beatId: opaqueId(value.beatId) ?? "first-wood.arrival",
    chapterId: idFromSet(value.chapterId, CHAPTER_ID_SET, JOURNEY_CHAPTER_IDS[0]),
    sceneId: idFromSet(value.sceneId, SCENE_ID_SET, JOURNEY_SCENE_IDS[0]),
    activeEntryId,
    history,
    visitedEntryIds,
    witnessedEntryIds: idArray(value.witnessedEntryIds, MAX_ENTRY_IDS, fragmentId),
    completedRitualIds: idArray(value.completedRitualIds, MAX_RITUAL_IDS),
    worldFlags: booleanRecord(value.worldFlags, MAX_WORLD_FLAGS),
    landmarkStates: landmarkRecord(value.landmarkStates),
    resonances: {
      wolf: boundedInteger(resonances?.wolf),
      swan: boundedInteger(resonances?.swan),
      seer: boundedInteger(resonances?.seer),
    },
    inventory: {
      lantern: inventory?.lantern === true,
      recoveredKeys: idArray(inventory?.recoveredKeys, MAX_INVENTORY_IDS),
      symbolicObjects: idArray(inventory?.symbolicObjects, MAX_INVENTORY_IDS),
    },
    releasedWords: releasedWords(value.releasedWords),
    completedActs,
    completedChapterIds,
    completedSceneIds,
    storyStarted: value.storyStarted === true || storyCompleted || hasNarrativeProgress,
    storyCompleted,
    storyStartedAt: value.storyStarted === true || storyCompleted || hasNarrativeProgress
      ? nullableIsoDate(value.storyStartedAt)
      : null,
    storyCompletedAt: storyCompleted ? nullableIsoDate(value.storyCompletedAt) : null,
    updatedAt: isoDate(value.updatedAt, timestamp),
  };
}
