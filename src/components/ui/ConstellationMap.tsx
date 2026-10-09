import { useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent, type WheelEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { JOURNEY_ENTRY_CONTEXT, journeyChapters, getJourneyChapterForEntry, getJourneySceneForEntry, type JourneyTechnicalBiome } from "../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import type { SlipperConstellationScope } from "../../lib/experienceMode";
import { buildStoryConstellationModel, deriveLanternNarrative, STORY_CONSTELLATION_ENTRY_COUNT, type ConstellationStoryState, type ConstellationStoryNode, type ConstellationStoryEdge } from "../../lib/lanternNarrative";
import { resolveNavigationTarget } from "../../lib/navigationResolver";
import { buildSpatialStoryNodes, entryWorldPosition, fitWorldToMap } from "../../lib/worldLayout";
import { useBreadcrumbStore, type BreadcrumbTrace } from "../../stores/useBreadcrumbStore";
import { useJourneyStore } from "../../stores/useJourneyStore";
import { useSettingsStore } from "../../stores/useSettingsStore";
import type { SceneProximityState } from "../../world/guidance/guidanceTypes";
import "./ConstellationMap.css";

export type SvgPoint = { x: number; y: number };
export type PanZoomState = { x: number; y: number; scale: number };
export type NumericVisualStyle = {
  "--resonance-strength"?: number;
  "--release-delay"?: string;
  "--release-drift-x"?: string;
  "--release-drift-y"?: string;
};

export const MAP_SIZE = 420;
export const MIN_ZOOM = 0.72;
export const MAX_ZOOM = 3.4;
export const RESONANCE_OFFSETS = {
  wolf: { x: -25, y: 10 },
  swan: { x: 0, y: -22 },
  seer: { x: 25, y: 10 },
} as const;

export function constellationZoomAt(viewport: PanZoomState, point: SvgPoint, deltaY: number): PanZoomState {
  if (![viewport.x, viewport.y, viewport.scale, point.x, point.y, deltaY].every(Number.isFinite) || viewport.scale <= 0) return { ...viewport };
  const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.scale * Math.exp(-deltaY * .0018)));
  return { scale, x: point.x - (point.x - viewport.x) / viewport.scale * scale,
    y: point.y - (point.y - viewport.y) / viewport.scale * scale };
}

export function constellationPanFromClientDelta(origin: PanZoomState, dx: number, dy: number, clientWidth: number): PanZoomState {
  if (![origin.x, origin.y, origin.scale, dx, dy, clientWidth].every(Number.isFinite) || clientWidth <= 0 || origin.scale <= 0) return { ...origin };
  return { ...origin, x: origin.x + dx * MAP_SIZE / clientWidth / origin.scale,
    y: origin.y + dy * MAP_SIZE / clientWidth / origin.scale };
}

export function shortTitle(title: string, limit = 42) {
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

export function biomeTone(biome: JourneyTechnicalBiome | undefined) {
  if (biome === "mirror") return "water";
  if (biome === "archive") return "memory";
  if (biome === "thorned") return "threshold";
  if (biome === "fireRiver") return "fire";
  if (biome === "crowned") return "crown";
  return "fragment";
}

export function chapterTint(biome: JourneyTechnicalBiome) {
  if (biome === "mirror") return "rgba(136,164,169,0.055)";
  if (biome === "thorned") return "rgba(161,142,123,0.05)";
  if (biome === "archive") return "rgba(157,171,177,0.045)";
  if (biome === "fireRiver") return "rgba(169,139,110,0.05)";
  if (biome === "crowned") return "rgba(190,176,144,0.05)";
  return "rgba(178,173,151,0.035)";
}

function cross(o: SvgPoint, a: SvgPoint, b: SvgPoint) {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function convexHull(points: SvgPoint[]) {
  if (points.length <= 2) return points;
  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
  const lower: SvgPoint[] = [];
  for (const point of sorted) {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= 0
    ) lower.pop();
    lower.push(point);
  }
  const upper: SvgPoint[] = [];
  for (let index = sorted.length - 1; index >= 0; index -= 1) {
    const point = sorted[index];
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= 0
    ) upper.pop();
    upper.push(point);
  }
  upper.pop();
  lower.pop();
  return lower.concat(upper);
}

export function centroid(points: SvgPoint[]) {
  const count = Math.max(1, points.length);
  return {
    x: points.reduce((total, point) => total + point.x, 0) / count,
    y: points.reduce((total, point) => total + point.y, 0) / count,
  };
}

function smoothClosedPath(points: SvgPoint[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  const commands = points.map((point, index) => {
    const previous = points[(index - 1 + points.length) % points.length];
    const next = points[(index + 1) % points.length];
    const nextNext = points[(index + 2) % points.length];
    const controlA = {
      x: point.x + (next.x - previous.x) * 0.16,
      y: point.y + (next.y - previous.y) * 0.16,
    };
    const controlB = {
      x: next.x - (nextNext.x - point.x) * 0.16,
      y: next.y - (nextNext.y - point.y) * 0.16,
    };
    return `C ${controlA.x.toFixed(1)} ${controlA.y.toFixed(1)}, ${controlB.x.toFixed(1)} ${controlB.y.toFixed(1)}, ${next.x.toFixed(1)} ${next.y.toFixed(1)}`;
  });
  return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} ${commands.join(" ")} Z`;
}

function organicBlobPath(cx: number, cy: number, radius: number, seed: number) {
  const points = Array.from({ length: 12 }, (_, index) => {
    const angle = (index / 12) * Math.PI * 2;
    const wobble =
      0.82 +
      Math.sin(seed * 0.013 + index * 1.73) * 0.11 +
      Math.cos(seed * 0.021 + index * 0.91) * 0.07;
    return {
      x: cx + Math.cos(angle) * radius * wobble,
      y: cy + Math.sin(angle) * radius * wobble,
    };
  });
  return smoothClosedPath(points);
}

export function expandedOrganicHullPath(points: SvgPoint[], seed: number) {
  if (points.length === 0) return "";
  const center = centroid(points);
  if (points.length < 3) {
    return organicBlobPath(center.x, center.y, Math.max(25, Math.sqrt(points.length + 1) * 18), seed);
  }
  const expanded = convexHull(points).map((point, index) => {
    const dx = point.x - center.x;
    const dy = point.y - center.y;
    const distance = Math.sqrt(dx * dx + dy * dy) || 1;
    const padding = 19 + Math.sin(seed * 0.018 + index * 1.41) * 4;
    return {
      x: point.x + (dx / distance) * padding,
      y: point.y + (dy / distance) * padding,
    };
  });
  return smoothClosedPath(expanded);
}

export function storyEdgePathD(
  edge: ConstellationStoryEdge,
  source: SvgPoint,
  target: SvgPoint,
) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const bend = edge.kind === "travel" ? 0.055 : edge.kind === "chapter" ? 0.035 : 0.02;
  const direction = edge.order % 2 === 0 ? 1 : -1;
  const midpoint = {
    x: (source.x + target.x) * 0.5 - dy * bend * direction,
    y: (source.y + target.y) * 0.5 + dx * bend * direction,
  };
  return `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${midpoint.x.toFixed(1)} ${midpoint.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;
}

export function guidancePathD(source: SvgPoint, target: SvgPoint) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const midpoint = {
    x: (source.x + target.x) * 0.5 - dy * 0.08,
    y: (source.y + target.y) * 0.5 + dx * 0.08,
  };
  return `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${midpoint.x.toFixed(1)} ${midpoint.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;
}


export type ConstellationGrowth = "dark" | "spark" | "threads" | "clusters" | "whole";
const canonicalEntryIds = new Set(Object.keys(JOURNEY_ENTRY_CONTEXT));

/** Pure presentation boundary. The existing model remains the only authority
 * for authored relationships, ritual/scar intensities and repeated travel.
 * Visiting or completing a place never admits its title as witnessed content.
 */
export function deriveConstellationMemory(state: ConstellationStoryState) {
  const witnessed = new Set(state.witnessedEntryIds.filter(id => canonicalEntryIds.has(id)));
  const canonical = buildStoryConstellationModel(state);
  const nodes = canonical.nodes.filter(node => witnessed.has(node.entryId));
  const edges = canonical.edges.filter(edge => witnessed.has(edge.sourceEntryId) && witnessed.has(edge.targetEntryId));
  const chapters = canonical.chapters.map(chapter => ({ ...chapter,
    visibleEntryIds: chapter.visibleEntryIds.filter(id => witnessed.has(id)),
  })).filter(chapter => chapter.visibleEntryIds.length > 0);
  // Keep interruptions explicit. Filtering IDs alone must never manufacture a
  // travelled edge between memories separated by an unwitnessed part of a route.
  const routeSegments: string[][] = [];
  let segment: string[] | null = null;
  for (const id of canonical.routeEntryIds) {
    if (!witnessed.has(id)) { segment = null; continue; }
    if (!segment) { segment = []; routeSegments.push(segment); }
    segment.push(id);
  }
  const routeEntryIds = routeSegments.flat();
  const nestIds = canonical.protectedNest.entryIds.filter(id => witnessed.has(id));
  const integrationWitnessed = chapters.some(chapter => chapter.id === "wolf-swan-seer");
  const releaseWitnessed = chapters.some(chapter => chapter.id === "fire-river");
  const growth: ConstellationGrowth = nodes.length === 0 ? "dark" : nodes.length === 1 ? "spark"
    : nodes.length < 6 ? "threads" : chapters.length === journeyChapters.length ? "whole" : "clusters";
  return { ...canonical, nodes, edges, chapters, routeEntryIds, routeSegments, growth,
    isNearlyEmpty: nodes.length <= 1 && edges.length === 0,
    progress: { ...canonical.progress, witnessedEntries: witnessed.size,
      routeSteps: routeSegments.reduce((count, part) => count + Math.max(0, part.length - 1), 0) },
    protectedNest: { ...canonical.protectedNest, visible: nestIds.length > 0, entryIds: nestIds },
    resonanceNodes: canonical.resonanceNodes.map(node => ({ ...node, visible: node.visible && integrationWitnessed })),
    releasedWords: releaseWitnessed ? canonical.releasedWords : [],
    releasedWordCount: releaseWitnessed ? canonical.releasedWordCount : 0,
    releaseBloom: releaseWitnessed ? canonical.releaseBloom : 0,
  };
}

export type ConstellationMemory = ReturnType<typeof deriveConstellationMemory>;
export type ConstellationEntryAction = "open" | "guide" | null;

/** Re-run against current canonical witnesses when an actual input arrives.
 * Unknown IDs and stale remembered controls cannot become readable content.
 */
export function constellationEntryAction(entryId: string, witnessedEntryIds: readonly string[],
  scope: SlipperConstellationScope, canOpen: boolean, canGuide: boolean): ConstellationEntryAction {
  if (!canonicalEntryIds.has(entryId)) return null;
  if (witnessedEntryIds.includes(entryId)) return canOpen ? "open" : null;
  return scope === "full" && canGuide ? "guide" : null;
}

export function constellationActionLabel(entry: { id: string; title: string }, activeEntryId: string,
  witnessedEntryIds: readonly string[]) {
  if (!witnessedEntryIds.includes(entry.id)) return "Guide through the forest to an unread memory";
  return entry.id === activeEntryId ? `Read current remembered fragment: ${entry.title}`
    : `Return to remembered fragment: ${entry.title}`;
}


type MemoryTitle = Pick<Slipper3DEntry, "id" | "title" | "chapter">;
const titleFor = (entry: Slipper3DEntry): MemoryTitle => ({ id: entry.id, title: entry.title, chapter: entry.chapter });
const finitePoint = (point: readonly number[]) => point.length === 3 && point.every(Number.isFinite);

/** Numeric layout and title admission, without React, stores, clocks or actions.
 * Future physical positions stay anonymous; only an opaque ID is retained for
 * the explicit full-view Guide callback. No body/paragraph is returned.
 */
export function deriveConstellationPresentation({ memory, entries, activeEntryId, visitedEntryIds,
  scope, breadcrumbTraces, sceneProximity }: {
  memory: ConstellationMemory; entries: Slipper3DEntry[]; activeEntryId: string;
  visitedEntryIds: string[]; scope: SlipperConstellationScope; breadcrumbTraces: readonly BreadcrumbTrace[];
  sceneProximity?: SceneProximityState | null;
}) {
  const witnessedSet = new Set(memory.nodes.map(node => node.entryId));
  const spatialNodes = buildSpatialStoryNodes({ activeEntryId, entries, visitedEntryIds });
  const allNodes = new Map(spatialNodes.map(node => [node.entry.id, node]));
  const projection = fitWorldToMap(entries.map(entry => entryWorldPosition(entry, entries)), MAP_SIZE, 34);
  const nodeMap = new Map(spatialNodes.filter(node => witnessedSet.has(node.entry.id)).map(node => [node.entry.id,
    { position: node.position, entry: titleFor(node.entry) }]));
  const activeNode = allNodes.get(activeEntryId);
  const activeEntry = witnessedSet.has(activeEntryId) && activeNode ? titleFor(activeNode.entry) : undefined;
  const chapter = activeEntry ? getJourneyChapterForEntry(activeEntryId) : undefined;
  const activeChapter = chapter ? { id: chapter.id, title: chapter.title } : undefined;
  const live = sceneProximity?.activeEntryId === activeEntryId ? sceneProximity : null;
  const fallback = scope === "full" ? resolveNavigationTarget({ nodes: spatialNodes, activeEntryId, visitedEntryIds, includeTitle: false,
    playerPosition: live?.playerPosition ?? activeNode?.position ?? [0, 0, 0], cameraYaw: live?.cameraYaw ?? 0 }) : null;
  const proposedTargetId = live?.navigationTargetId ?? fallback?.entryId ?? null;
  const navigationTargetId = proposedTargetId && allNodes.has(proposedTargetId)
    && (scope === "full" || witnessedSet.has(proposedTargetId)) ? proposedTargetId : null;
  const target = navigationTargetId ? allNodes.get(navigationTargetId) : undefined;
  const targetWitnessed = navigationTargetId !== null && witnessedSet.has(navigationTargetId);
  const targetNode = target ? { position: target.position,
    entry: targetWitnessed ? titleFor(target.entry) : { id: target.entry.id, title: "Unread memory", chapter: "A path still forming" } } : undefined;
  const targetPoint = targetNode ? projection.project(targetNode.position) : null;
  const playerWorldPosition = live?.playerPosition ?? activeNode?.position ?? null;
  const playerPoint = playerWorldPosition && finitePoint(playerWorldPosition) ? projection.project(playerWorldPosition) : null;
  const anonymousPoints = entries.filter(entry => !witnessedSet.has(entry.id)).map(entry => projection.project(entryWorldPosition(entry, entries)));
  const chapterRegions = memory.isNearlyEmpty ? [] : memory.chapters.flatMap(chapter => {
    const points = chapter.visibleEntryIds.flatMap((id): SvgPoint[] => {
      const node = nodeMap.get(id); return node ? [projection.project(node.position)] : [];
    });
    const seed = chapter.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
    return points.length ? [{ ...chapter, path: expandedOrganicHullPath(points, seed), tint: chapterTint(chapter.biome) }] : [];
  });
  const chapterPoints = (id: string) => (memory.chapters.find(chapter => chapter.id === id)?.visibleEntryIds ?? [])
    .flatMap((entryId): SvgPoint[] => { const node = nodeMap.get(entryId); return node ? [projection.project(node.position)] : []; });
  const integrationPoints = chapterPoints("wolf-swan-seer");
  const integrationAnchor = integrationPoints.length ? centroid(integrationPoints) : { x: MAP_SIZE * .5, y: MAP_SIZE * .5 };
  const resonanceGlyphs = memory.resonanceNodes.filter(node => node.visible).map(node => ({ ...node,
    point: { x: integrationAnchor.x + RESONANCE_OFFSETS[node.id].x, y: integrationAnchor.y + RESONANCE_OFFSETS[node.id].y } }));
  const releasePoints = chapterPoints("fire-river");
  const releaseAnchor = releasePoints.length ? centroid(releasePoints) : { x: MAP_SIZE * .5, y: MAP_SIZE * .58 };
  const releasedWordGlyphs = memory.releasedWords.slice(-12).map((word, index) => {
    const angle = index * 2.399963 + word.length * .31, radius = 18 + index * 8;
    return { id: `${word}:${index}`, word,
      point: { x: releaseAnchor.x + Math.cos(angle) * radius, y: releaseAnchor.y + Math.sin(angle) * radius * .72 },
      style: { "--release-delay": `${(-index * 1.17).toFixed(2)}s`, "--release-drift-x": `${(Math.cos(angle + .7) * 8).toFixed(1)}px`,
        "--release-drift-y": `${(-8 - index % 3 * 4).toFixed(1)}px` } };
  });
  const admittedBreadcrumbs = memory.isNearlyEmpty ? [] : breadcrumbTraces.filter(trace => witnessedSet.has(trace.activeEntryId)
    && finitePoint(trace.position) && Number.isFinite(trace.scale) && Number.isFinite(trace.intensity)
    && ["footprint", "ember", "puddle", "ghost"].includes(trace.kind)).slice(-120);
  const breadcrumbDots = admittedBreadcrumbs.map((trace, index) => ({ id: index, point: projection.project(trace.position), kind: trace.kind,
    r: Number((1.1 + Math.max(0, Math.min(4, trace.scale)) * .72).toFixed(2)),
    opacity: Number(((.06 + (admittedBreadcrumbs.length <= 1 ? 1 : index / (admittedBreadcrumbs.length - 1)) * .2)
      * Math.max(.34, Math.min(1, trace.intensity))).toFixed(3)) }));
  const orderedIds = [...(targetWitnessed && navigationTargetId ? [navigationTargetId] : []),
    ...[...memory.routeEntryIds].reverse(), ...memory.nodes.map(node => node.entryId)];
  const listedEntries = [...new Set(orderedIds)].flatMap(id => {
    const node = nodeMap.get(id); return node ? [node.entry] : [];
  });
  return { nodeMap, projection, activeEntry, activeChapter, navigationTargetId, targetNode, targetPoint,
    targetIsStoryNode: targetWitnessed, targetWitnessed, playerPoint, anonymousPoints, chapterRegions,
    resonanceGlyphs, releasedWordGlyphs, breadcrumbDots, listedEntries,
    mapTrailState: live?.trailState ?? "map-planned" };
}


/** The caller admits witnessed titles before this presentational list exists.
 * Inputs provide an explicit, fresh-gated remembered action; no store is read.
 */
export function ConstellationMemoryList({ entries, nodes, activeEntryId, targetEntryId, canOpen, onOpen, actionLabel }: {
  entries: readonly Pick<Slipper3DEntry, "id" | "title" | "chapter">[];
  nodes: ReadonlyMap<string, ConstellationStoryNode>;
  activeEntryId: string; targetEntryId: string | null;
  canOpen: (id: string) => boolean; onOpen: (id: string) => void;
  actionLabel: (entry: { id: string; title: string }) => string;
}) {
  return <div className="constellation-list">{entries.map(entry => {
    const node = nodes.get(entry.id), active = entry.id === activeEntryId, target = entry.id === targetEntryId;
    const scene = getJourneySceneForEntry(entry.id);
    return <button key={entry.id} type="button" onClick={() => onOpen(entry.id)} disabled={!canOpen(entry.id)}
      className={`constellation-row${active ? " is-active" : ""}${target ? " is-target" : ""} is-visited`}
      aria-current={active ? "location" : undefined} aria-label={actionLabel(entry)}>
      <span className={`constellation-row-dot is-${biomeTone(scene?.biome)}`} aria-hidden="true" />
      <span><strong>{shortTitle(entry.title, 36)}</strong><small>{getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}</small></span>
      <em>{active ? "present" : target ? "guidance" : node?.stage ?? "witnessed"}</em>
    </button>;
  })}</div>;
}


type ConstellationVisualStyle = CSSProperties & NumericVisualStyle;

export type ConstellationMapProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  /** Both scopes disclose titles only for canonical witnessed memories. */
  scope?: SlipperConstellationScope;
  sceneProximity?: SceneProximityState | null;
  /** Opens or returns to a remembered fragment. */
  onOpenEntry?: (entryId: string) => void;
  /** Starts guidance for an unread fragment without changing the active entry. */
  onGuideEntry?: (entryId: string) => void;
  /** @deprecated Use onOpenEntry. Never used for unread fragments. */
  onSelectEntry?: (entryId: string) => void;
  panelId?: string;
  labelledBy?: string;
  hidden?: boolean;
};

export function ConstellationMap({
  entries,
  activeEntryId,
  visitedEntryIds,
  scope = "full",
  sceneProximity,
  onOpenEntry,
  onGuideEntry,
  onSelectEntry,
  panelId,
  labelledBy,
  hidden = false,
}: ConstellationMapProps) {
  const mapTitleId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    x: number;
    y: number;
    origin: PanZoomState;
  } | null>(null);
  const [viewport, setViewport] = useState<PanZoomState>({ x: 0, y: 0, scale: 1 });
  const [isDragging, setIsDragging] = useState(false);
  const breadcrumbTraces = useBreadcrumbStore((state) => state.traces);
  const journeyState = useJourneyStore(useShallow((state) => ({
    chapterId: state.chapterId,
    sceneId: state.sceneId,
    history: state.history,
    witnessedEntryIds: state.witnessedEntryIds,
    completedActs: state.completedActs,
    completedChapterIds: state.completedChapterIds,
    completedSceneIds: state.completedSceneIds,
    completedRitualIds: state.completedRitualIds,
    worldFlags: state.worldFlags,
    landmarkStates: state.landmarkStates,
    resonances: state.resonances,
    inventory: state.inventory,
    releasedWords: state.releasedWords,
    storyStarted: state.storyStarted,
    storyCompleted: state.storyCompleted,
  })));

  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const storyModel = useMemo(() => deriveConstellationMemory({ ...journeyState, activeEntryId }), [activeEntryId, journeyState]);
  const witnessedSet = useMemo(() => new Set(storyModel.nodes.map(node => node.entryId)), [storyModel.nodes]);
  const rememberedSet = witnessedSet;
  const storyNodeMap = useMemo(() => new Map(storyModel.nodes.map(node => [node.entryId, node])), [storyModel.nodes]);
  const lantern = useMemo(() => deriveLanternNarrative(journeyState), [journeyState]);
  const openRememberedEntry = onOpenEntry ?? onSelectEntry;
  const frame = useMemo(() => deriveConstellationPresentation({ memory: storyModel, entries, activeEntryId, visitedEntryIds,
    scope, breadcrumbTraces, sceneProximity }), [storyModel, entries, activeEntryId, visitedEntryIds, scope, breadcrumbTraces, sceneProximity]);
  const { nodeMap, projection, activeEntry, activeChapter, navigationTargetId, targetNode, targetPoint, targetIsStoryNode,
    targetWitnessed, playerPoint, anonymousPoints, chapterRegions, resonanceGlyphs, releasedWordGlyphs, breadcrumbDots,
    listedEntries, mapTrailState } = frame;
  const progressPercent = Math.round(storyModel.progress.witnessedEntries / Math.max(1, STORY_CONSTELLATION_ENTRY_COUNT) * 100);
  const progressStyle = { "--progress": `${progressPercent}%` } as CSSProperties;

  const svgClientToMap = (event: { clientX: number; clientY: number }) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return { x: MAP_SIZE / 2, y: MAP_SIZE / 2 };
    return {
      x: ((event.clientX - rect.left) / rect.width) * MAP_SIZE,
      y: ((event.clientY - rect.top) / rect.height) * MAP_SIZE,
    };
  };

  const handlePointerDown = (event: PointerEvent<SVGSVGElement>) => {
    const target = event.target as SVGElement;
    if (target.closest(".constellation-node-button")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    setIsDragging(true);
    dragRef.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      origin: viewport,
    };
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!drag || drag.pointerId !== event.pointerId || !rect) return;
    setViewport(constellationPanFromClientDelta(drag.origin, event.clientX - drag.x, event.clientY - drag.y, rect.width));
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setIsDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: WheelEvent<SVGSVGElement>) => {
    event.preventDefault();
    const point = svgClientToMap(event);
    setViewport(constellationZoomAt(viewport, point, event.deltaY));
  };

  const resetMap = () => setViewport({ x: 0, y: 0, scale: 1 });
  const actionForEntry = (entryId: string) => constellationEntryAction(entryId,
    useJourneyStore.getState().witnessedEntryIds, scope, Boolean(openRememberedEntry), Boolean(onGuideEntry));
  const activateEntry = (entryId: string, expected: ConstellationEntryAction) => {
    const action = actionForEntry(entryId);
    if (!action || action !== expected) return;
    (action === "open" ? openRememberedEntry : onGuideEntry)?.(entryId);
  };
  const entryActionLabel = (entry: { id: string; title: string }) => constellationActionLabel(entry,
    activeEntryId, journeyState.witnessedEntryIds);

  const renderStoryNode = (storyNode: ConstellationStoryNode) => {
    const spatialNode = nodeMap.get(storyNode.entryId);
    if (!spatialNode) return null;
    const point = projection.project(spatialNode.position);
    const isActive = storyNode.entryId === activeEntryId;
    const isTarget = storyNode.entryId === navigationTargetId;
    const actionAvailable = Boolean(actionForEntry(storyNode.entryId));
    const isKeyboardLandmark = isActive || isTarget;
    const entry = spatialNode.entry;
    // Keep physical positions and generous hit areas; only the visible light varies.
    const lightVariation = ((storyNode.firstVisitOrder ?? 0) % 3) * 0.16;
    const coreRadius = Number((0.95 + storyNode.intensity * 0.65 + lightVariation).toFixed(2));
    const ringRadius = Number((coreRadius + (isActive ? 3 : isTarget ? 2.6 : 2)).toFixed(2));
    return (
      <g
        key={storyNode.entryId}
        className={`constellation-node constellation-node-button is-${biomeTone(storyNode.biome)} is-${storyNode.stage}${isActive ? " is-active" : ""}${isTarget ? " is-target" : ""}`}
        style={{ "--node-intensity": storyNode.intensity } as CSSProperties}
        role={isKeyboardLandmark ? "button" : undefined}
        tabIndex={isKeyboardLandmark && actionAvailable ? 0 : -1}
        data-keyboard-landmark={isKeyboardLandmark ? "true" : undefined}
        data-constellation-entry-id={storyNode.entryId}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => activateEntry(storyNode.entryId, "open")}
        onKeyDown={(event) => {
          if (isKeyboardLandmark && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            activateEntry(storyNode.entryId, "open");
          }
        }}
        aria-label={isKeyboardLandmark ? entryActionLabel(entry) : undefined}
        aria-current={isKeyboardLandmark && isActive ? "location" : undefined}
        aria-disabled={isKeyboardLandmark ? !actionAvailable : undefined}
        aria-hidden={isKeyboardLandmark ? undefined : true}
      >
        <title>{entryActionLabel(entry)}</title>
        <circle className="constellation-node-hit" cx={point.x} cy={point.y} r="22" />
        <circle className="constellation-node-ring" cx={point.x} cy={point.y} r={ringRadius} />
        <circle className="constellation-node-core" cx={point.x} cy={point.y} r={coreRadius} />
        {isActive || isTarget ? (
          <text className="constellation-label is-visible" x={point.x + 10} y={point.y - 9}>
            {shortTitle(entry.title, 24)}
          </text>
        ) : null}
      </g>
    );
  };

  return (
    <aside
      className={`constellation-panel is-lantern-${lantern.id}`}
      id={panelId}
      role={labelledBy ? "tabpanel" : undefined}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Living story constellation controls"}
      tabIndex={labelledBy ? 0 : undefined}
      hidden={hidden}
      data-constellation-scope={scope}
      data-constellation-growth={storyModel.growth}
      data-constellation-motion={reducedMotion ? "reduced" : "full"}
    >
      <div className="constellation-header">
        <div>
          <p className="constellation-kicker">living memory constellation</p>
          <h2 className="constellation-title">{activeEntry?.title ?? "Unlit memory"}</h2>
          <span className="constellation-lantern-phase">{lantern.title}</span>
        </div>
        {scope === "full" ? <details className="constellation-memory-details"><summary>Memory details</summary><div className="constellation-progress" style={progressStyle}>
          <p className="constellation-progress-text">{progressPercent}% witnessed</p>
          <div className="constellation-progress-bar" aria-hidden="true">
            <span className="constellation-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div></details> : null}
      </div>

      <p className="constellation-status" role="status">
        {scope === "witnessed-only" ? storyModel.nodes.length === 0
          ? "The constellation is almost dark."
          : "Witnessed memories remain in the constellation."
          : storyModel.isNearlyEmpty
          ? "The constellation is almost dark."
          : `${storyModel.nodes.length} memories shape the visible constellation.`}{" "}
        {scope === "full" ? <>{storyModel.progress.routeSteps} travelled steps are retained.{" "}
        {storyModel.progress.completedChapters} of {journeyChapters.length} chapters are complete.</> : null}
      </p>

      <div
        className={`constellation-map${isDragging ? " is-dragging" : ""}${storyModel.isNearlyEmpty ? " is-nearly-empty" : ""}`}
        role="group"
        aria-label="Living story constellation"
      >
        <button
          type="button"
          className="constellation-map-reset"
          onClick={resetMap}
          aria-label="Reset constellation pan and zoom"
        >
          reset
        </button>
        <svg
          ref={svgRef}
          className="constellation-spatial-svg"
          viewBox={`0 0 ${MAP_SIZE} ${MAP_SIZE}`}
          role="group"
          aria-labelledby={mapTitleId}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onWheel={handleWheel}
        >
          <title id={mapTitleId}>
            Living story constellation. {storyModel.nodes.length} revealed memories.
            {targetNode ? targetWitnessed ? ` Guidance target: ${targetNode.entry.title}.` : " An unread path is available." : ""}
          </title>
          <defs>
            <filter id="constellation-node-glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="constellation-breadcrumb-glow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          <g transform={`translate(${viewport.x.toFixed(1)} ${viewport.y.toFixed(1)}) scale(${viewport.scale.toFixed(3)})`}>
            {anonymousPoints.map((point, index) => <circle key={index} className="constellation-unwitnessed-dot"
              data-constellation-future="true" aria-hidden="true" cx={point.x} cy={point.y} r="0.8" />)}
            {chapterRegions.map((region) => (
              <g
                key={region.id}
                className={`constellation-region is-${region.completed ? "complete" : "forming"}${region.id === "nest" ? ` is-protected-nest${storyModel.protectedNest.protected ? " is-protected" : ""}` : ""}`}
                style={{ "--region-tint": region.tint } as CSSProperties}
                data-protected-nest={region.id === "nest" ? storyModel.protectedNest.protected : undefined}
              >
                <title>{region.title}</title>
                <path d={region.path} />
                {region.id === "nest" && storyModel.protectedNest.protected ? (
                  <path className="constellation-nest-protection-ring" d={region.path} />
                ) : null}
              </g>
            ))}

            {storyModel.edges.map((edge) => {
              const sourceNode = nodeMap.get(edge.sourceEntryId);
              const destinationNode = nodeMap.get(edge.targetEntryId);
              if (!sourceNode || !destinationNode) return null;
              const source = projection.project(sourceNode.position);
              const target = projection.project(destinationNode.position);
              return (
                <path
                  key={edge.id}
                  className={`constellation-link is-story-${edge.kind}`}
                  d={storyEdgePathD(edge, source, target)}
                />
              );
            })}

            {breadcrumbDots.length > 1 ? (
              <g className="constellation-breadcrumb-layer" filter="url(#constellation-breadcrumb-glow)">
                {breadcrumbDots.map((dot) => (
                  <circle
                    key={dot.id}
                    className={`constellation-breadcrumb-dot is-${dot.kind}`}
                    cx={dot.point.x}
                    cy={dot.point.y}
                    r={dot.r}
                    opacity={dot.opacity}
                  />
                ))}
              </g>
            ) : null}

            {playerPoint && targetPoint ? (
              <path className="constellation-guidance-line" d={guidancePathD(playerPoint, targetPoint)} />
            ) : null}

            {storyModel.nodes.map(renderStoryNode)}

            {resonanceGlyphs.length > 1 ? (
              <path
                className="constellation-resonance-thread"
                d={`${resonanceGlyphs.map((node, index) => `${index === 0 ? "M" : "L"} ${node.point.x.toFixed(1)} ${node.point.y.toFixed(1)}`).join(" ")} Z`}
              />
            ) : null}
            {resonanceGlyphs.map((node) => (
              <g
                key={node.id}
                className={`constellation-resonance-node is-${node.id}`}
                data-resonance-node={node.id}
                style={{ "--resonance-strength": node.intensity } as ConstellationVisualStyle}
                role="img"
                aria-label={`${node.label} resonance ${Math.round(node.strength)} of 100`}
              >
                <title>{node.label} — a major light shaped by the journey</title>
                <circle className="constellation-resonance-halo" cx={node.point.x} cy={node.point.y} r={4 + node.intensity * 1.2} />
                <circle className="constellation-resonance-core" cx={node.point.x} cy={node.point.y} r={1.7 + node.intensity * 0.9} />
                <text className="constellation-resonance-label" x={node.point.x} y={node.point.y + 19}>{node.label}</text>
              </g>
            ))}

            <g className="constellation-released-words" aria-label={`${storyModel.releasedWordCount} released words in the constellation`}>
              {releasedWordGlyphs.map((word) => (
                <g
                  key={word.id}
                  className="constellation-released-word"
                  data-released-word={word.word}
                  style={word.style as ConstellationVisualStyle}
                  role="img"
                  aria-label={`Released word: ${word.word}`}
                >
                  <title>Released word: {word.word}</title>
                  <circle cx={word.point.x} cy={word.point.y} r="2.4" />
                  <text x={word.point.x + 6} y={word.point.y + 2}>{shortTitle(word.word, 18)}</text>
                </g>
              ))}
            </g>

            {targetNode && targetPoint && !targetIsStoryNode ? (
              <g
                className="constellation-node constellation-guidance-point is-guidance-ghost is-target"
                role="button"
                tabIndex={actionForEntry(targetNode.entry.id) ? 0 : -1}
                data-keyboard-landmark="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => activateEntry(targetNode.entry.id, targetWitnessed ? "open" : "guide")}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activateEntry(targetNode.entry.id, targetWitnessed ? "open" : "guide");
                  }
                }}
                aria-label={entryActionLabel(targetNode.entry)}
              >
                <title>{entryActionLabel(targetNode.entry)}</title>
                <circle className="constellation-node-hit" cx={targetPoint.x} cy={targetPoint.y} r="22" />
                <circle className="constellation-node-ring" cx={targetPoint.x} cy={targetPoint.y} r="7" />
                <circle className="constellation-node-core" cx={targetPoint.x} cy={targetPoint.y} r="3.2" />
                <text className="constellation-label is-visible" x={targetPoint.x + 10} y={targetPoint.y - 9}>
                  {shortTitle(targetNode.entry.title, 24)}
                </text>
              </g>
            ) : null}

            {playerPoint ? (
              <g
                className="constellation-player-marker"
                role="img"
                aria-label={`Current position near ${activeEntry?.title ?? "the present point"}`}
              >
                <title>Current position near {activeEntry?.title ?? "the present point"}</title>
                <circle cx={playerPoint.x} cy={playerPoint.y} r="8" />
                <path d={`M ${(playerPoint.x - 5).toFixed(1)} ${(playerPoint.y - 10).toFixed(1)} L ${playerPoint.x.toFixed(1)} ${(playerPoint.y - 18).toFixed(1)} L ${(playerPoint.x + 5).toFixed(1)} ${(playerPoint.y - 10).toFixed(1)} Z`} />
              </g>
            ) : null}
          </g>
        </svg>

        {scope === "full" ? <details className="constellation-memory-details"><summary>Remembered path</summary><div className="constellation-legend" aria-hidden="true">
          <span className="is-entry">{storyModel.progress.witnessedEntries}/66 witnessed</span>
          <span className="is-tag">{mapTrailState}</span>
          <span className="is-chapter">{storyModel.progress.completedChapters}/{journeyChapters.length} chapters</span>
          <span className="is-active">{lantern.id}</span>
        </div></details> : null}
      </div>

      {scope === "full" ? <details className="constellation-memory-details"><summary>Memory state</summary><div className="constellation-story-summary" aria-label="Constellation memory state">
        <span>{storyModel.progress.completedScenes}/32 scenes</span>
        <span>{storyModel.progress.completedRituals} story moments</span>
        <span>{storyModel.landmarkMemory.activeCount} landmarks</span>
        <span>{storyModel.releasedWordCount} words released</span>
      </div></details> : null}

      {scope === "full" || targetNode ? <div className="constellation-route-panel">
        <div>
          <p className="constellation-kicker">guidance target</p>
          <strong>{targetNode?.entry.title ?? "No target resolved"}</strong>
          <span>
            {targetNode
              ? targetWitnessed ? getJourneyChapterForEntry(targetNode.entry.id)?.title ?? "A path still forming" : "A path still forming"
              : activeChapter?.title ?? "Open the forest to resolve a physical route."}
          </span>
        </div>
        <button
          type="button"
          disabled={!targetNode || !actionForEntry(targetNode.entry.id)}
          onClick={() => targetNode && activateEntry(targetNode.entry.id, targetWitnessed ? "open" : "guide")}
          aria-label={targetNode ? entryActionLabel(targetNode.entry) : "No guidance target available"}
        >
          {targetNode && rememberedSet.has(targetNode.entry.id) ? "Read target" : "Guide me there"}
        </button>
      </div> : null}

      {scope === "full" ? <details className="constellation-memory-details"><summary>Remembered fragments</summary>
        <ConstellationMemoryList entries={listedEntries} nodes={storyNodeMap} activeEntryId={activeEntryId} targetEntryId={navigationTargetId}
          canOpen={id => actionForEntry(id) === "open"} onOpen={id => activateEntry(id, "open")} actionLabel={entryActionLabel} />
      </details> : <ConstellationMemoryList entries={listedEntries} nodes={storyNodeMap} activeEntryId={activeEntryId} targetEntryId={navigationTargetId}
        canOpen={id => actionForEntry(id) === "open"} onOpen={id => activateEntry(id, "open")} actionLabel={entryActionLabel} />}
    </aside>
  );
}

export default ConstellationMap;
