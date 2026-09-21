import type {
  ContentDiagnostics,
  EmotionalTone,
  PortalLocation,
  SceneKind,
  Slipper3DEntry,
  Slipper3DVisual,
  SlipperEntry,
  SlipperVisual,
  SpatialRole,
} from "../data/slipper3dTypes";

const DEFAULT_ENVIRONMENT_RADIUS = 50;
const VIEWBOX_SIZE = 240;
const CENTER = VIEWBOX_SIZE / 2;

const PORTAL_POSITIONS: Array<[number, number, number]> = [
  [-2.72, -0.05, -4.18],
  [2.72, -0.05, -4.18],
  [0, -0.82, -4.92],
  [-1.48, 0.98, -4.65],
];

const FALLBACK_VISUALS: Slipper3DVisual[] = [
  {
    id: "visual-forest-threshold",
    src: "/visuals/forest-threshold.svg",
    orientation: "landscape",
    environmentKind: "flat-panorama",
    alt: "Fallback forest threshold environment.",
    chapter: "Fallback",
    tags: ["forest", "threshold"],
  },
  {
    id: "visual-ash-clearing",
    src: "/visuals/ash-clearing.svg",
    orientation: "landscape",
    environmentKind: "flat-panorama",
    alt: "Fallback ash clearing environment.",
    chapter: "Fallback",
    tags: ["clearing", "memory"],
  },
  {
    id: "visual-moon-archive",
    src: "/visuals/moon-archive.svg",
    orientation: "landscape",
    environmentKind: "flat-panorama",
    alt: "Fallback moon archive environment.",
    chapter: "Fallback",
    tags: ["moon", "archive"],
  },
];

function compactText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueStrings(values: Array<string | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => compactText(value))
        .filter(Boolean),
    ),
  );
}

function safeId(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

function sortEntries(entries: SlipperEntry[]) {
  return [...entries].sort((a, b) => {
    const sequenceA = a.sequence ?? Number.MAX_SAFE_INTEGER;
    const sequenceB = b.sequence ?? Number.MAX_SAFE_INTEGER;

    if (sequenceA !== sequenceB) return sequenceA - sequenceB;
    return a.title.localeCompare(b.title);
  });
}

function normalizeVisual(visual: SlipperVisual, index: number): Slipper3DVisual {
  const src = compactText(visual.src) || FALLBACK_VISUALS[index % FALLBACK_VISUALS.length].src;
  const orientation = visual.orientation ?? (src.match(/portrait/i) ? "portrait" : "landscape");
  const environmentKind =
    orientation === "landscape" ? "flat-panorama" : orientation === "square" ? "square-plane" : "portrait-plane";

  return {
    ...visual,
    id: compactText(visual.id) || `visual-${index + 1}`,
    src,
    orientation,
    tags: visual.tags ?? [],
    environmentKind,
    environmentIntensity: orientation === "landscape" ? 1 : 0.86,
  };
}

function visualScore(entry: SlipperEntry, visual: Slipper3DVisual) {
  let score = 0;
  const entryTags = new Set((entry.tags ?? []).map((tag) => tag.toLowerCase()));
  const visualTags = new Set((visual.tags ?? []).map((tag) => tag.toLowerCase()));

  if (entry.chapter && visual.chapter && entry.chapter === visual.chapter) score += 8;

  for (const tag of entryTags) {
    if (visualTags.has(tag)) score += 4;
    if (visual.id.toLowerCase().includes(tag)) score += 2;
    if (visual.src.toLowerCase().includes(tag)) score += 2;
  }

  if (entry.title && visual.src.toLowerCase().includes(safeId(entry.title, "").split("-").join(""))) {
    score += 4;
  }

  if (visual.orientation === "landscape") score += 1;
  return score;
}

function resolveVisualId(entry: SlipperEntry, visuals: Slipper3DVisual[], index: number) {
  const explicitId = entry.linkedVisualId ?? entry.visualId ?? entry.heroVisualId;
  if (explicitId && visuals.some((visual) => visual.id === explicitId)) return explicitId;

  const scored = visuals
    .map((visual) => ({ visual, score: visualScore(entry, visual) }))
    .sort((a, b) => b.score - a.score);

  if (scored[0]?.score > 0) return scored[0].visual.id;

  return visuals[index % visuals.length]?.id ?? FALLBACK_VISUALS[index % FALLBACK_VISUALS.length].id;
}

function textFor(entry: SlipperEntry) {
  return `${entry.chapter} ${entry.title} ${(entry.tags ?? []).join(" ")} ${entry.body ?? ""}`.toLowerCase();
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function inferSceneSemantics(entry: SlipperEntry, index: number): {
  mood: string;
  sceneKind: SceneKind;
  emotionalTone: EmotionalTone;
  spatialRole: SpatialRole;
  symbolicWeight: 1 | 2 | 3 | 4 | 5;
  ambience: NonNullable<Slipper3DEntry["engine3d"]["ambience"]>;
  gradient: [string, string, string?];
  color: string;
} {
  const text = textFor(entry);
  const sequence = entry.sequence ?? index + 1;

  if (includesAny(text, ["moon", "archive", "night", "stars", "blue"])) {
    return {
      mood: entry.mood ?? "archive",
      sceneKind: "archive",
      emotionalTone: "memory",
      spatialRole: sequence <= 2 ? "entrance" : "memory",
      symbolicWeight: 4,
      ambience: { backgroundColor: "#04060b", fogColor: "#06101b", fogNear: 10, fogFar: 45 },
      gradient: ["#03050b", "#10192b", "#b8c8d8"],
      color: "#b8c8d8",
    };
  }

  if (includesAny(text, ["mirror", "reflection", "water", "river", "pool"])) {
    return {
      mood: entry.mood ?? "mirror",
      sceneKind: includesAny(text, ["river"]) ? "river" : "mirror",
      emotionalTone: "water",
      spatialRole: "revelation",
      symbolicWeight: 4,
      ambience: { backgroundColor: "#05090b", fogColor: "#071113", fogNear: 9, fogFar: 42 },
      gradient: ["#040607", "#0e2528", "#9fb6ad"],
      color: "#9fb6ad",
    };
  }

  if (includesAny(text, ["fire", "ember", "ash", "burn", "flame"])) {
    return {
      mood: entry.mood ?? "ember",
      sceneKind: includesAny(text, ["river"]) ? "river" : "clearing",
      emotionalTone: "fire",
      spatialRole: "trial",
      symbolicWeight: 5,
      ambience: { backgroundColor: "#080403", fogColor: "#120807", fogNear: 10, fogFar: 40 },
      gradient: ["#090303", "#1a0f0a", "#d8a86e"],
      color: "#d8a86e",
    };
  }

  if (includesAny(text, ["house", "room", "door", "wall", "thorn"])) {
    return {
      mood: entry.mood ?? "threshold",
      sceneKind: "house",
      emotionalTone: "threshold",
      spatialRole: includesAny(text, ["door", "threshold"]) ? "crossing" : "trial",
      symbolicWeight: 4,
      ambience: { backgroundColor: "#050506", fogColor: "#070606", fogNear: 10, fogFar: 38 },
      gradient: ["#050506", "#15100f", "#c8b38a"],
      color: "#c8b38a",
    };
  }

  if (includesAny(text, ["crown", "return", "king", "queen", "again"])) {
    return {
      mood: entry.mood ?? "return",
      sceneKind: "crown",
      emotionalTone: "return",
      spatialRole: "exit",
      symbolicWeight: 5,
      ambience: { backgroundColor: "#070708", fogColor: "#0b0a08", fogNear: 11, fogFar: 46 },
      gradient: ["#050506", "#15110a", "#e8d49a"],
      color: "#e8d49a",
    };
  }

  if (includesAny(text, ["first", "threshold", "begin", "entrance"])) {
    return {
      mood: entry.mood ?? "threshold",
      sceneKind: "threshold",
      emotionalTone: "threshold",
      spatialRole: "entrance",
      symbolicWeight: 3,
      ambience: { backgroundColor: "#050506", fogColor: "#050506", fogNear: 12, fogFar: 44 },
      gradient: ["#050506", "#0f1110", "#c8b38a"],
      color: "#c8b38a",
    };
  }

  const palette = ["#c8b38a", "#9fb6ad", "#b8c8d8", "#d8d0ba"];
  const color = palette[index % palette.length];

  return {
    mood: entry.mood ?? "wood",
    sceneKind: "wood",
    emotionalTone: includesAny(text, ["silence", "quiet"]) ? "silence" : "memory",
    spatialRole: sequence <= 1 ? "entrance" : "memory",
    symbolicWeight: 3,
    ambience: { backgroundColor: "#050506", fogColor: "#060707", fogNear: 11, fogFar: 44 },
    gradient: ["#050506", "#0d1110", color],
    color,
  };
}

function constellationPosition(index: number, total: number, chapterIndex: number, chapterCount: number): [number, number] {
  if (total <= 1) return [CENTER, CENTER];

  const chapterAngle = -Math.PI / 2 + (chapterIndex / Math.max(chapterCount, 1)) * Math.PI * 2;
  const chapterRadius = 62;
  const localAngle = -Math.PI / 2 + (index / total) * Math.PI * 8;
  const localRadius = 8 + (index % 7) * 3.3;

  const x = CENTER + Math.cos(chapterAngle) * chapterRadius + Math.cos(localAngle) * localRadius;
  const y = CENTER + Math.sin(chapterAngle) * chapterRadius + Math.sin(localAngle) * localRadius;

  return [
    Math.max(14, Math.min(VIEWBOX_SIZE - 14, Math.round(x))),
    Math.max(14, Math.min(VIEWBOX_SIZE - 14, Math.round(y))),
  ];
}

function findFirstOtherByTag(entries: Slipper3DEntry[], entry: Slipper3DEntry, tag: string) {
  return entries.find((candidate) => candidate.id !== entry.id && candidate.tags.includes(tag));
}

function findFirstInNextChapter(entries: Slipper3DEntry[], entry: Slipper3DEntry, chapters: string[]) {
  const chapterIndex = chapters.indexOf(entry.chapter);
  const nextChapter = chapters[(chapterIndex + 1) % chapters.length];
  return entries.find((candidate) => candidate.chapter === nextChapter && candidate.id !== entry.id);
}

function buildPortals(entry: Slipper3DEntry, index: number, entries: Slipper3DEntry[], chapters: string[]): PortalLocation[] {
  const portals: PortalLocation[] = [];
  const nextEntry = entries[(index + 1) % entries.length];

  if (nextEntry && nextEntry.id !== entry.id) {
    portals.push({
      id: `portal-next-${entry.id}`,
      label: "next clearing",
      kind: "entry",
      targetEntryId: nextEntry.id,
      position: PORTAL_POSITIONS[0],
      color: nextEntry.engine3d.environmentGradient?.[2] ?? "#d8d0ba",
      strength: 5,
      description: `Continue to “${nextEntry.title}”.`,
    });
  }

  const tagTargets = uniqueStrings(entry.tags)
    .filter((tag) => !["visual", "portrait", "square", "landscape"].includes(tag.toLowerCase()))
    .slice(0, 2)
    .map((tag) => ({ tag, target: findFirstOtherByTag(entries, entry, tag) }));

  for (const { tag, target } of tagTargets) {
    if (!target || portals.some((portal) => portal.targetEntryId === target.id)) continue;
    portals.push({
      id: `portal-tag-${entry.id}-${safeId(tag, "tag")}`,
      label: tag,
      kind: "tag",
      tag,
      targetEntryId: target.id,
      position: PORTAL_POSITIONS[portals.length % PORTAL_POSITIONS.length],
      color: target.engine3d.environmentGradient?.[2] ?? "#9fb6ad",
      strength: 3,
      description: `Follow “${tag}” to “${target.title}”.`,
    });
  }

  const nextChapterEntry = findFirstInNextChapter(entries, entry, chapters);
  if (nextChapterEntry && !portals.some((portal) => portal.targetEntryId === nextChapterEntry.id)) {
    portals.push({
      id: `portal-chapter-${entry.id}`,
      label: nextChapterEntry.chapter,
      kind: "chapter",
      targetChapter: nextChapterEntry.chapter,
      targetEntryId: nextChapterEntry.id,
      position: PORTAL_POSITIONS[portals.length % PORTAL_POSITIONS.length],
      color: nextChapterEntry.engine3d.environmentGradient?.[2] ?? "#b8c8d8",
      strength: 4,
      description: `Cross into “${nextChapterEntry.chapter}”.`,
    });
  }

  return portals.slice(0, 4);
}

export function migrateSlipperArchiveTo3D(rawEntries: SlipperEntry[], rawVisuals: SlipperVisual[]) {
  const normalizedVisuals = rawVisuals.length > 0 ? rawVisuals.map(normalizeVisual) : FALLBACK_VISUALS;
  const orderedEntries = sortEntries(rawEntries);
  const chapters = uniqueStrings(orderedEntries.map((entry) => entry.chapter || "Unchaptered"));
  const chapterIndex = new Map(chapters.map((chapter, index) => [chapter, index]));

  const entriesWithoutPortals: Slipper3DEntry[] = orderedEntries.map((rawEntry, index) => {
    const chapter = compactText(rawEntry.chapter) || "Unchaptered";
    const tags = uniqueStrings(rawEntry.tags ?? []);
    const paragraphs = rawEntry.paragraphs?.length
      ? rawEntry.paragraphs.map(compactText).filter(Boolean)
      : compactText(rawEntry.body)
        ? compactText(rawEntry.body)
            .split(/\n{2,}/)
            .map((paragraph) => paragraph.trim())
            .filter(Boolean)
        : [];
    const semantics = inferSceneSemantics({ ...rawEntry, chapter, tags }, index);

    return {
      ...rawEntry,
      id: compactText(rawEntry.id) || `fragment-${String(index + 1).padStart(3, "0")}`,
      title: compactText(rawEntry.title) || `Untitled Fragment ${index + 1}`,
      chapter,
      tags,
      body: compactText(rawEntry.body) || paragraphs.join("\n\n"),
      paragraphs,
      sequence: rawEntry.sequence ?? index + 1,
      engine3d: {
        linkedVisualId: resolveVisualId(rawEntry, normalizedVisuals, index),
        environmentRadius: DEFAULT_ENVIRONMENT_RADIUS,
        cameraStart: [0, 0, 0.1],
        cameraTarget: [0, 0, -1],
        cameraFov: 62 + (semantics.symbolicWeight - 1),
        textPosition: [0, 0.1 + ((index % 3) - 1) * 0.04, -3.15 - (index % 2) * 0.14],
        textRotation: [0, 0, 0],
        textMaxWidth: 580,
        textDistanceFactor: 1.1,
        mood: semantics.mood,
        sceneKind: semantics.sceneKind,
        emotionalTone: semantics.emotionalTone,
        spatialRole: semantics.spatialRole,
        symbolicWeight: semantics.symbolicWeight,
        environmentGradient: semantics.gradient,
        constellationPosition: constellationPosition(
          index,
          orderedEntries.length,
          chapterIndex.get(chapter) ?? 0,
          chapters.length,
        ),
        ambience: semantics.ambience,
        portalLocations: [],
      },
    };
  });

  const entries = entriesWithoutPortals.map((entry, index) => ({
    ...entry,
    engine3d: {
      ...entry.engine3d,
      portalLocations: buildPortals(entry, index, entriesWithoutPortals, chapters),
    },
  }));

  return {
    entries,
    visuals: normalizedVisuals,
    diagnostics: buildContentDiagnostics(entries, normalizedVisuals),
  };
}

export function buildContentDiagnostics(entries: Slipper3DEntry[], visuals: Slipper3DVisual[]): ContentDiagnostics {
  const duplicateEntryIds = duplicateIds(entries.map((entry) => entry.id));
  const duplicateVisualIds = duplicateIds(visuals.map((visual) => visual.id));
  const visualIds = new Set(visuals.map((visual) => visual.id));

  return {
    entryCount: entries.length,
    visualCount: visuals.length,
    chapterCount: new Set(entries.map((entry) => entry.chapter)).size,
    tagCount: new Set(entries.flatMap((entry) => entry.tags)).size,
    entriesMissingParagraphs: entries.filter((entry) => entry.paragraphs.length === 0).map((entry) => entry.id),
    entriesUsingFallbackVisual: entries
      .filter((entry) => !visualIds.has(entry.engine3d.linkedVisualId))
      .map((entry) => entry.id),
    duplicateEntryIds,
    duplicateVisualIds,
  };
}

function duplicateIds(ids: string[]) {
  const seen = new Set<string>();
  const duplicates = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) duplicates.add(id);
    seen.add(id);
  }

  return Array.from(duplicates);
}
