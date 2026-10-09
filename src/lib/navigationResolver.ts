import type { Vector3Tuple } from "../data/slipper3dTypes";
import { getOrderedEntries } from "./storyGraph";
import type { MazePathSegment, SpatialStoryNode } from "./worldLayout";
import { nearestMazePathSegment } from "./worldLayout";
import {
  trailStateForDistance,
  type TrailState,
} from "./navigationPresentation";

export {
  rotateXZByYaw,
  trailStateForDistance,
  trailStateLabel,
  type TrailState,
} from "./navigationPresentation";
export type NavigationTargetReason = "next" | "neighbor" | "unvisited" | "chapter" | "return";
export type RouteClass = "primary" | "secondary" | "visited" | "background";

export type NavigationTarget = {
  entryId: string;
  title: string;
  position: Vector3Tuple;
  distance: number;
  score: number;
  reason: NavigationTargetReason;
};

export function distanceXZSq(a: Vector3Tuple, b: Vector3Tuple) {
  const dx = a[0] - b[0];
  const dz = a[2] - b[2];
  return dx * dx + dz * dz;
}

export function yawFromDirection(x: number, z: number) {
  return Math.atan2(x, z);
}

export function nearestPathStatus({
  playerPosition,
  pathSegments,
  insideClearing = false,
}: {
  playerPosition: Vector3Tuple;
  pathSegments: MazePathSegment[];
  insideClearing?: boolean;
}) {
  const nearest = nearestMazePathSegment(playerPosition[0], playerPosition[2], pathSegments);
  const distance = nearest.segment ? Math.sqrt(nearest.distanceSq) : Number.POSITIVE_INFINITY;
  return {
    segment: nearest.segment,
    projectionT: nearest.projectionT,
    distance,
    state: trailStateForDistance(distance, insideClearing),
  };
}

export function resolveNavigationTarget({
  nodes,
  activeEntryId,
  visitedEntryIds,
  playerPosition,
  cameraYaw,
  includeTitle = true,
}: {
  nodes: SpatialStoryNode[];
  activeEntryId: string;
  visitedEntryIds: string[];
  playerPosition: Vector3Tuple;
  cameraYaw: number;
  /** Geometry-only consumers can resolve a route without reading private prose. */
  includeTitle?: boolean;
}): NavigationTarget | null {
  if (nodes.length === 0) return null;

  const ordered = getOrderedEntries(nodes.map((node) => node.entry));
  const activeIndex = ordered.findIndex((entry) => entry.id === activeEntryId);
  const nextSequentialId = activeIndex >= 0 ? ordered[(activeIndex + 1) % ordered.length]?.id : undefined;
  const activeNode = nodes.find((node) => node.entry.id === activeEntryId);
  const activeChapter = activeNode?.entry.chapter;
  const visitedSet = new Set(visitedEntryIds);

  let best: NavigationTarget | null = null;

  for (const node of nodes) {
    if (node.entry.id === activeEntryId) continue;

    const dx = node.position[0] - playerPosition[0];
    const dz = node.position[2] - playerPosition[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const targetYaw = Math.atan2(dx, dz);
    const yawDelta = Math.atan2(Math.sin(targetYaw - cameraYaw), Math.cos(targetYaw - cameraYaw));
    const forwardScore = Math.cos(yawDelta);
    const isVisited = visitedSet.has(node.entry.id);
    const isNext = node.entry.id === nextSequentialId;
    const sameChapter = activeChapter && node.entry.chapter === activeChapter;

    let reason: NavigationTargetReason = "unvisited";
    if (isNext) reason = "next";
    else if (node.graphDistance === 1) reason = "neighbor";
    else if (sameChapter) reason = "chapter";
    else if (isVisited) reason = "return";

    let score = 0;
    score += node.graphDistance === 1 ? 52 : 0;
    score += isNext ? 42 : 0;
    score += sameChapter ? 10 : 0;
    score += !isVisited ? 24 : -10;
    score += (forwardScore + 1) * 7;
    score -= Math.min(65, distance) * 0.52;
    if (distance < 4) score -= 8;

    const candidate: NavigationTarget = {
      entryId: node.entry.id,
      title: includeTitle ? node.entry.title : "",
      position: node.position,
      distance,
      score,
      reason,
    };

    if (!best || candidate.score > best.score) best = candidate;
  }

  return best;
}

export function classifyRouteSegment({
  segment,
  activeEntryId,
  navigationTargetId,
  visitedEntryIds,
}: {
  segment: MazePathSegment;
  activeEntryId: string;
  navigationTargetId?: string | null;
  visitedEntryIds: Set<string> | string[];
}): RouteClass {
  const visitedSet = visitedEntryIds instanceof Set ? visitedEntryIds : new Set(visitedEntryIds);
  const sourceId = segment.sourceEntry.id;
  const targetId = segment.targetEntry.id;
  const touchesActive = sourceId === activeEntryId || targetId === activeEntryId;
  const touchesTarget = Boolean(navigationTargetId && (sourceId === navigationTargetId || targetId === navigationTargetId));

  if (touchesActive && touchesTarget) return "primary";
  if (touchesActive || touchesTarget) return "secondary";
  if (visitedSet.has(sourceId) && visitedSet.has(targetId)) return "visited";
  return "background";
}

export function routeClassWeight(routeClass: RouteClass) {
  if (routeClass === "primary") return 1;
  if (routeClass === "secondary") return 0.58;
  if (routeClass === "visited") return 0.34;
  return 0.14;
}
