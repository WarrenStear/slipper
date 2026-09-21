import type { PortalKind, PortalLocation, Slipper3DEntry } from "../data/slipper3dTypes";

const AUTO_PORTAL_POSITIONS: Array<[number, number, number]> = [
  [-2.65, -0.05, -4.15],
  [2.65, -0.05, -4.15],
  [0, -0.72, -4.85],
];

export type StoryGraphLink = {
  sourceId: string;
  targetId: string;
  kind: PortalKind;
  label: string;
};

export type EntryAdjacency = {
  previous?: Slipper3DEntry;
  next?: Slipper3DEntry;
  chapterEntries: Slipper3DEntry[];
  chapterIndex: number;
};

function bySequenceThenTitle(a: Slipper3DEntry, b: Slipper3DEntry) {
  const sequenceA = a.sequence ?? Number.MAX_SAFE_INTEGER;
  const sequenceB = b.sequence ?? Number.MAX_SAFE_INTEGER;

  if (sequenceA !== sequenceB) return sequenceA - sequenceB;
  return a.title.localeCompare(b.title);
}

export function getEntryById(entries: Slipper3DEntry[], entryId: string) {
  return entries.find((entry) => entry.id === entryId);
}

export function getOrderedEntries(entries: Slipper3DEntry[]) {
  return [...entries].sort(bySequenceThenTitle);
}

export function getEntryIndex(entries: Slipper3DEntry[], currentEntryId: string) {
  return getOrderedEntries(entries).findIndex((entry) => entry.id === currentEntryId);
}

export function getNextEntry(entries: Slipper3DEntry[], currentEntryId: string) {
  const ordered = getOrderedEntries(entries);
  const currentIndex = ordered.findIndex((entry) => entry.id === currentEntryId);

  if (currentIndex === -1 || ordered.length === 0) return undefined;
  return ordered[(currentIndex + 1) % ordered.length];
}

export function getPreviousEntry(entries: Slipper3DEntry[], currentEntryId: string) {
  const ordered = getOrderedEntries(entries);
  const currentIndex = ordered.findIndex((entry) => entry.id === currentEntryId);

  if (currentIndex === -1 || ordered.length === 0) return undefined;
  return ordered[(currentIndex - 1 + ordered.length) % ordered.length];
}

export function getChapterEntries(entries: Slipper3DEntry[], chapter: string) {
  return getOrderedEntries(entries).filter((entry) => entry.chapter === chapter);
}

export function getEntryAdjacency(entries: Slipper3DEntry[], currentEntryId: string): EntryAdjacency {
  const currentEntry = getEntryById(entries, currentEntryId);
  const chapterEntries = currentEntry ? getChapterEntries(entries, currentEntry.chapter) : [];

  return {
    previous: getPreviousEntry(entries, currentEntryId),
    next: getNextEntry(entries, currentEntryId),
    chapterEntries,
    chapterIndex: chapterEntries.findIndex((entry) => entry.id === currentEntryId),
  };
}

export function getFirstEntryForChapter(
  entries: Slipper3DEntry[],
  chapter: string,
  currentEntryId: string,
) {
  return getOrderedEntries(entries)
    .filter((entry) => entry.chapter === chapter && entry.id !== currentEntryId)[0];
}

export function getFirstEntryForTag(entries: Slipper3DEntry[], tag: string, currentEntryId: string) {
  return getOrderedEntries(entries)
    .filter((entry) => entry.id !== currentEntryId && entry.tags.includes(tag))[0];
}

function resolveExplicitPortal(
  portal: PortalLocation,
  entry: Slipper3DEntry,
  entries: Slipper3DEntry[],
): PortalLocation | undefined {
  if (portal.targetEntryId && getEntryById(entries, portal.targetEntryId)) {
    return portal;
  }

  const tagTarget = portal.tag ? getFirstEntryForTag(entries, portal.tag, entry.id) : undefined;
  const chapterTarget = portal.targetChapter
    ? getFirstEntryForChapter(entries, portal.targetChapter, entry.id)
    : undefined;
  const fallbackTarget = getNextEntry(entries, entry.id);
  const target = tagTarget ?? chapterTarget ?? fallbackTarget;

  if (!target || target.id === entry.id) return undefined;

  return {
    ...portal,
    targetEntryId: target.id,
    description: portal.description ?? target.title,
  };
}

function buildAutomaticPortals(entry: Slipper3DEntry, entries: Slipper3DEntry[]): PortalLocation[] {
  const uniqueTags = Array.from(new Set(entry.tags)).slice(0, 2);
  const tagPortals = uniqueTags
    .map((tag, index): PortalLocation | undefined => {
      const target = getFirstEntryForTag(entries, tag, entry.id);
      if (!target) return undefined;

      return {
        id: `auto-tag-${entry.id}-${tag}`,
        label: tag,
        kind: "tag",
        tag,
        targetEntryId: target.id,
        position: AUTO_PORTAL_POSITIONS[index],
        color: index === 0 ? "#c8b38a" : "#9fb6ad",
        description: `Follow this thread to “${target.title}”.`,
        strength: 3,
      };
    })
    .filter(Boolean) as PortalLocation[];

  const nextEntry = getNextEntry(entries, entry.id);
  const nextPortal: PortalLocation[] =
    nextEntry && nextEntry.id !== entry.id
      ? [
          {
            id: `auto-next-${entry.id}`,
            label: "next clearing",
            kind: "entry",
            targetEntryId: nextEntry.id,
            position: AUTO_PORTAL_POSITIONS[2],
            color: "#d8d0ba",
            description: `Continue to “${nextEntry.title}”.`,
            strength: 4,
          },
        ]
      : [];

  return [...tagPortals, ...nextPortal];
}

export function getScenePortals(entry: Slipper3DEntry, entries: Slipper3DEntry[]) {
  const explicitPortals = entry.engine3d.portalLocations ?? [];

  if (explicitPortals.length > 0) {
    return explicitPortals
      .map((portal) => resolveExplicitPortal(portal, entry, entries))
      .filter(Boolean) as PortalLocation[];
  }

  return buildAutomaticPortals(entry, entries);
}

export function getStoryGraphLinks(entries: Slipper3DEntry[]): StoryGraphLink[] {
  const links = new Map<string, StoryGraphLink>();

  for (const entry of entries) {
    const portals = getScenePortals(entry, entries);

    for (const portal of portals) {
      if (!portal.targetEntryId || portal.targetEntryId === entry.id) continue;

      const key = `${entry.id}->${portal.targetEntryId}->${portal.kind}`;
      links.set(key, {
        sourceId: entry.id,
        targetId: portal.targetEntryId,
        kind: portal.kind,
        label: portal.label,
      });
    }
  }

  return Array.from(links.values());
}

export function getChapterProgress(entries: Slipper3DEntry[], visitedEntryIds: string[]) {
  const visitedSet = new Set(visitedEntryIds);
  const chapterMap = new Map<string, { chapter: string; total: number; visited: number }>();

  for (const entry of entries) {
    const existing = chapterMap.get(entry.chapter) ?? {
      chapter: entry.chapter,
      total: 0,
      visited: 0,
    };

    existing.total += 1;
    existing.visited += visitedSet.has(entry.id) ? 1 : 0;
    chapterMap.set(entry.chapter, existing);
  }

  return Array.from(chapterMap.values());
}
