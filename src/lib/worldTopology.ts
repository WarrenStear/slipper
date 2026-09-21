import type { Vector3Tuple } from "../data/slipper3dTypes";
import { journeyScenes } from "../data/journeyNarrative.ts";

export type PhysicalPathRole = "backbone" | "shortcut";

export type PhysicalStoryNode = {
  id: string;
  chapter: string;
  sequence?: number;
  position: Vector3Tuple;
};

export type PhysicalStoryLink = {
  sourceId: string;
  targetId: string;
  role: PhysicalPathRole;
};

const CANONICAL_JOURNEY_ENTRY_IDS = journeyScenes.flatMap((scene) => scene.entryIds);

function buildCanonicalJourneyLinks(nodes: PhysicalStoryNode[]) {
  if (nodes.length !== CANONICAL_JOURNEY_ENTRY_IDS.length) return null;
  const nodeIds = new Set(nodes.map((node) => node.id));
  if (nodeIds.size !== CANONICAL_JOURNEY_ENTRY_IDS.length) return null;
  if (CANONICAL_JOURNEY_ENTRY_IDS.some((entryId) => !nodeIds.has(entryId))) return null;

  const links: PhysicalStoryLink[] = [];
  for (let sceneIndex = 0; sceneIndex < journeyScenes.length; sceneIndex += 1) {
    const scene = journeyScenes[sceneIndex];
    const nextScene = journeyScenes[sceneIndex + 1];
    if (nextScene) {
      links.push({
        sourceId: scene.keystoneEntryId,
        targetId: nextScene.keystoneEntryId,
        role: "backbone",
      });
    }

    // Echoes form short, finite side paths from their substantial scene. A
    // chain keeps the main route readable and gives the forest real dead ends
    // without turning the ground plane into a web of semantic cross-links.
    let previousId = scene.keystoneEntryId;
    for (const echoEntryId of scene.echoEntryIds) {
      links.push({ sourceId: previousId, targetId: echoEntryId, role: "shortcut" });
      previousId = echoEntryId;
    }
  }
  return links;
}

type Point = { x: number; z: number };

function orderedNodes(nodes: PhysicalStoryNode[]) {
  return nodes
    .map((node, index) => ({ node, index }))
    .sort((a, b) => {
      const sequenceA = Number.isFinite(a.node.sequence) ? Number(a.node.sequence) : a.index + 1;
      const sequenceB = Number.isFinite(b.node.sequence) ? Number(b.node.sequence) : b.index + 1;
      return sequenceA - sequenceB || a.node.id.localeCompare(b.node.id);
    })
    .map(({ node }) => node);
}

function linkKey(sourceId: string, targetId: string) {
  return [sourceId, targetId].sort().join("::");
}

function stableUnit(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0) / 4294967295;
}

function orientation(a: Point, b: Point, c: Point) {
  return (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
}

function segmentsCross(a: Point, b: Point, c: Point, d: Point) {
  const epsilon = 0.00001;
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  return abC * abD < -epsilon && cdA * cdB < -epsilon;
}

function distanceToSegment(point: Point, source: Point, target: Point) {
  const dx = target.x - source.x;
  const dz = target.z - source.z;
  const lengthSq = dx * dx + dz * dz;
  const t = lengthSq > 0
    ? Math.max(0, Math.min(1, ((point.x - source.x) * dx + (point.z - source.z) * dz) / lengthSq))
    : 0;
  return Math.hypot(point.x - (source.x + dx * t), point.z - (source.z + dz * t));
}

function graphHopDistance(
  adjacency: Map<string, Set<string>>,
  sourceId: string,
  targetId: string,
  maxDepth: number,
) {
  const queue: Array<{ id: string; depth: number }> = [{ id: sourceId, depth: 0 }];
  const visited = new Set([sourceId]);
  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) break;
    if (current.id === targetId) return current.depth;
    if (current.depth >= maxDepth) continue;
    for (const neighbor of adjacency.get(current.id) ?? []) {
      if (visited.has(neighbor)) continue;
      visited.add(neighbor);
      queue.push({ id: neighbor, depth: current.depth + 1 });
    }
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * Builds the small physical network used for walking and rendering.
 *
 * The canonical 66-fragment archive resolves to a 32-scene narrative spine
 * plus finite Echo branches above. Narrative/tag links remain available to the
 * reader and constellation, but never become cross-forest corridors. The
 * generic planar builder below remains only for partial or legacy archives.
 */
export function buildPhysicalStoryLinks(nodes: PhysicalStoryNode[]): PhysicalStoryLink[] {
  const canonicalJourneyLinks = buildCanonicalJourneyLinks(nodes);
  if (canonicalJourneyLinks) return canonicalJourneyLinks;

  const ordered = orderedNodes(nodes);
  if (ordered.length < 2) return [];

  const byId = new Map(ordered.map((node) => [node.id, node]));
  const indexById = new Map(ordered.map((node, index) => [node.id, index]));
  const selected: PhysicalStoryLink[] = [];
  const selectedKeys = new Set<string>();
  const degree = new Map(ordered.map((node) => [node.id, 0]));
  const adjacency = new Map(ordered.map((node) => [node.id, new Set<string>()]));

  const add = (sourceId: string, targetId: string, role: PhysicalPathRole) => {
    const key = linkKey(sourceId, targetId);
    if (selectedKeys.has(key)) return;
    selectedKeys.add(key);
    selected.push({ sourceId, targetId, role });
    degree.set(sourceId, (degree.get(sourceId) ?? 0) + 1);
    degree.set(targetId, (degree.get(targetId) ?? 0) + 1);
    adjacency.get(sourceId)?.add(targetId);
    adjacency.get(targetId)?.add(sourceId);
  };

  const crossesExisting = (sourceId: string, targetId: string) => {
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target) return true;
    const sourcePoint = { x: source.position[0], z: source.position[2] };
    const targetPoint = { x: target.position[0], z: target.position[2] };
    return selected.some((link) => {
      if (
        link.sourceId === source.id ||
        link.targetId === source.id ||
        link.sourceId === target.id ||
        link.targetId === target.id
      ) return false;
      const selectedSource = byId.get(link.sourceId);
      const selectedTarget = byId.get(link.targetId);
      if (!selectedSource || !selectedTarget) return false;
      return segmentsCross(
        sourcePoint,
        targetPoint,
        { x: selectedSource.position[0], z: selectedSource.position[2] },
        { x: selectedTarget.position[0], z: selectedTarget.position[2] },
      );
    });
  };

  const entersAnotherPocket = (sourceId: string, targetId: string) => {
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (!source || !target) return true;
    const sourcePoint = { x: source.position[0], z: source.position[2] };
    const targetPoint = { x: target.position[0], z: target.position[2] };
    return ordered.some((node) => {
      if (node.id === source.id || node.id === target.id) return false;
      return distanceToSegment(
        { x: node.position[0], z: node.position[2] },
        sourcePoint,
        targetPoint,
      ) < 7.8;
    });
  };

  type Candidate = {
    sourceId: string;
    targetId: string;
    distance: number;
    chapterBand: string;
    weight: number;
  };

  const chapterOrder: string[] = [];
  const chapterNodes = new Map<string, PhysicalStoryNode[]>();
  for (const node of ordered) {
    if (!chapterNodes.has(node.chapter)) {
      chapterOrder.push(node.chapter);
      chapterNodes.set(node.chapter, []);
    }
    chapterNodes.get(node.chapter)?.push(node);
  }

  const loopCandidates: Candidate[] = [];
  for (const chapter of chapterOrder) {
    const members = chapterNodes.get(chapter) ?? [];
    if (members.length < 2) continue;

    // The final act is a clear ceremonial ascent rather than another maze.
    if (chapter === "The Crowned Return") {
      for (let index = 0; index < members.length - 1; index += 1) {
        add(members[index].id, members[index + 1].id, "backbone");
      }
      continue;
    }

    const parent = new Map(members.map((node) => [node.id, node.id]));
    const find = (id: string): string => {
      const current = parent.get(id) ?? id;
      if (current === id) return id;
      const root = find(current);
      parent.set(id, root);
      return root;
    };
    const join = (sourceId: string, targetId: string) => {
      const sourceRoot = find(sourceId);
      const targetRoot = find(targetId);
      if (sourceRoot === targetRoot) return false;
      parent.set(targetRoot, sourceRoot);
      return true;
    };

    const candidates: Candidate[] = [];
    for (let sourceIndex = 0; sourceIndex < members.length; sourceIndex += 1) {
      for (let targetIndex = sourceIndex + 1; targetIndex < members.length; targetIndex += 1) {
        const source = members[sourceIndex];
        const target = members[targetIndex];
        const distance = Math.hypot(
          target.position[0] - source.position[0],
          target.position[2] - source.position[2],
        );
        if (distance > 26.5) continue;
        const key = linkKey(source.id, target.id);
        candidates.push({
          sourceId: source.id,
          targetId: target.id,
          distance,
          chapterBand: chapter,
          weight: stableUnit(`${chapter}:${key}`) * 0.74 + (distance / 26.5) * 0.26,
        });
      }
    }
    candidates.sort((a, b) => a.weight - b.weight || a.distance - b.distance || linkKey(a.sourceId, a.targetId).localeCompare(linkKey(b.sourceId, b.targetId)));

    const selectTreeEdges = (maxDegree: number) => {
      for (const candidate of candidates) {
        if (find(candidate.sourceId) === find(candidate.targetId)) continue;
        if ((degree.get(candidate.sourceId) ?? 0) >= maxDegree || (degree.get(candidate.targetId) ?? 0) >= maxDegree) continue;
        if (crossesExisting(candidate.sourceId, candidate.targetId) || entersAnotherPocket(candidate.sourceId, candidate.targetId)) continue;
        if (!join(candidate.sourceId, candidate.targetId)) continue;
        add(candidate.sourceId, candidate.targetId, "backbone");
      }
    };
    selectTreeEdges(3);
    selectTreeEdges(4);

    // The compact authored grid always connects above. This final shortest-edge
    // pass also keeps hand-authored future chapter layouts reachable.
    const fallbackCandidates = [...candidates].sort((a, b) => a.distance - b.distance || a.weight - b.weight);
    for (const candidate of fallbackCandidates) {
      if (find(candidate.sourceId) === find(candidate.targetId)) continue;
      if (crossesExisting(candidate.sourceId, candidate.targetId) || entersAnotherPocket(candidate.sourceId, candidate.targetId)) continue;
      if (!join(candidate.sourceId, candidate.targetId)) continue;
      add(candidate.sourceId, candidate.targetId, "backbone");
    }

    for (const candidate of candidates) {
      if (!selectedKeys.has(linkKey(candidate.sourceId, candidate.targetId))) loopCandidates.push(candidate);
    }
  }

  // One authored threshold joins each region to the next. Semantic relationships
  // can still be explored through the archive without cutting across acts.
  for (let chapterIndex = 0; chapterIndex < chapterOrder.length - 1; chapterIndex += 1) {
    const sourceMembers = chapterNodes.get(chapterOrder[chapterIndex]) ?? [];
    const targetMembers = chapterNodes.get(chapterOrder[chapterIndex + 1]) ?? [];
    const source = sourceMembers[sourceMembers.length - 1];
    const target = targetMembers[0];
    if (source && target) add(source.id, target.id, "backbone");
  }

  loopCandidates.sort((a, b) => a.weight - b.weight || a.distance - b.distance);
  const shortcutLimit = Math.floor(ordered.length / 8);
  const shortcutsByChapter = new Map<string, number>();
  let shortcutCount = 0;
  for (const candidate of loopCandidates) {
    if (shortcutCount >= shortcutLimit) break;
    if ((shortcutsByChapter.get(candidate.chapterBand) ?? 0) >= 2) continue;
    if ((degree.get(candidate.sourceId) ?? 0) >= 3 || (degree.get(candidate.targetId) ?? 0) >= 3) continue;
    if (graphHopDistance(adjacency, candidate.sourceId, candidate.targetId, 2) <= 2) continue;
    if (crossesExisting(candidate.sourceId, candidate.targetId) || entersAnotherPocket(candidate.sourceId, candidate.targetId)) continue;
    add(candidate.sourceId, candidate.targetId, "shortcut");
    shortcutsByChapter.set(candidate.chapterBand, (shortcutsByChapter.get(candidate.chapterBand) ?? 0) + 1);
    shortcutCount += 1;
  }

  // Keep source/target order stable even when callers provide the same entries
  // in a different array order.
  return selected.map((link) => {
    const sourceIndex = indexById.get(link.sourceId) ?? 0;
    const targetIndex = indexById.get(link.targetId) ?? 0;
    return sourceIndex <= targetIndex
      ? link
      : { ...link, sourceId: link.targetId, targetId: link.sourceId };
  });
}
