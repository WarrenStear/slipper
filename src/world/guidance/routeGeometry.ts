import { type MazePathSegment } from "../terrain/worldPaths.ts";

export function guidedPathSegment(
  pathSegments: MazePathSegment[],
  activeEntryId: string,
  navigationTargetId: string | null,
) {
  if (navigationTargetId && navigationTargetId !== activeEntryId) {
    const queue = [activeEntryId];
    const visited = new Set(queue);
    const firstSegmentByEntry = new Map<string, MazePathSegment>();

    while (queue.length > 0) {
      const entryId = queue.shift();
      if (!entryId) break;
      for (const segment of pathSegments) {
        const sourceId = segment.sourceEntry.id;
        const targetId = segment.targetEntry.id;
        const nextId = sourceId === entryId ? targetId : targetId === entryId ? sourceId : null;
        if (!nextId || visited.has(nextId)) continue;
        visited.add(nextId);
        const firstSegment = firstSegmentByEntry.get(entryId) ?? segment;
        firstSegmentByEntry.set(nextId, firstSegment);
        if (nextId === navigationTargetId) return firstSegment;
        queue.push(nextId);
      }
    }
  }

  return (
    pathSegments.find(
      (candidate) =>
        candidate.sourceEntry.id === activeEntryId ||
        candidate.targetEntry.id === activeEntryId,
    ) ??
    pathSegments[0]
  );
}

