import {
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
  type WheelEvent,
} from "react";
import { useShallow } from "zustand/react/shallow";
import {
  getJourneyChapterForEntry,
  getJourneySceneForEntry,
  journeyChapters,
  type JourneyTechnicalBiome,
} from "../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import type { SlipperConstellationScope } from "../../lib/experienceMode";
import {
  buildStoryConstellationModel,
  deriveLanternNarrative,
  STORY_CONSTELLATION_ENTRY_COUNT,
  type ConstellationStoryEdge,
  type ConstellationStoryNode,
} from "../../lib/lanternNarrative";
import { resolveNavigationTarget } from "../../lib/navigationResolver";
import {
  buildSpatialStoryNodes,
  entryWorldPosition,
  fitWorldToMap,
} from "../../lib/worldLayout";
import { useBreadcrumbStore } from "../../stores/useBreadcrumbStore";
import { useJourneyStore } from "../../stores/useJourneyStore";
import type { SceneProximityState } from "../three/StoryScene";
import "./ConstellationMap.css";

export type ConstellationMapProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  /** Directed journeys disclose only canonical witnessed memories. */
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

type SvgPoint = { x: number; y: number };
type PanZoomState = { x: number; y: number; scale: number };
type ConstellationVisualStyle = CSSProperties & {
  "--resonance-strength"?: number;
  "--release-delay"?: string;
  "--release-drift-x"?: string;
  "--release-drift-y"?: string;
};

const MAP_SIZE = 420;
const MIN_ZOOM = 0.72;
const MAX_ZOOM = 3.4;
const RESONANCE_OFFSETS = {
  wolf: { x: -25, y: 10 },
  swan: { x: 0, y: -22 },
  seer: { x: 25, y: 10 },
} as const;

function shortTitle(title: string, limit = 42) {
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function biomeTone(biome: JourneyTechnicalBiome | undefined) {
  if (biome === "mirror") return "water";
  if (biome === "archive") return "memory";
  if (biome === "thorned") return "threshold";
  if (biome === "fireRiver") return "fire";
  if (biome === "crowned") return "crown";
  return "fragment";
}

function chapterTint(biome: JourneyTechnicalBiome) {
  if (biome === "mirror") return "rgba(111,183,200,0.18)";
  if (biome === "thorned") return "rgba(141,122,106,0.18)";
  if (biome === "archive") return "rgba(184,200,216,0.18)";
  if (biome === "fireRiver") return "rgba(200,106,46,0.18)";
  if (biome === "crowned") return "rgba(215,184,92,0.2)";
  return "rgba(216,208,186,0.16)";
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

function centroid(points: SvgPoint[]) {
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

function expandedOrganicHullPath(points: SvgPoint[], seed: number) {
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

function storyEdgePathD(
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

function guidancePathD(source: SvgPoint, target: SvgPoint) {
  const dx = target.x - source.x;
  const dy = target.y - source.y;
  const midpoint = {
    x: (source.x + target.x) * 0.5 - dy * 0.08,
    y: (source.y + target.y) * 0.5 + dx * 0.08,
  };
  return `M ${source.x.toFixed(1)} ${source.y.toFixed(1)} Q ${midpoint.x.toFixed(1)} ${midpoint.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`;
}

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

  const witnessedSet = useMemo(() => new Set(journeyState.witnessedEntryIds.filter(
    entryId => Boolean(getJourneySceneForEntry(entryId)),
  )), [journeyState.witnessedEntryIds]);
  const storyModel = useMemo(() => {
    const model = buildStoryConstellationModel({ ...journeyState, activeEntryId });
    if (scope === "full") return model;
    // Adapt the existing earned model; filtering never invents an edge between
    // remembered endpoints whose actual route crossed an unwitnessed memory.
    const nodes = model.nodes.filter(node => witnessedSet.has(node.entryId));
    return {
      ...model,
      nodes,
      edges: model.edges.filter(edge => witnessedSet.has(edge.sourceEntryId) && witnessedSet.has(edge.targetEntryId)),
      routeEntryIds: model.routeEntryIds.filter(entryId => witnessedSet.has(entryId)),
      chapters: model.chapters.map(chapter => ({ ...chapter,
        visibleEntryIds: chapter.visibleEntryIds.filter(entryId => witnessedSet.has(entryId)),
      })).filter(chapter => chapter.visibleEntryIds.length > 0),
      isNearlyEmpty: nodes.length <= 1,
    };
  }, [activeEntryId, journeyState, scope, witnessedSet]);
  const lantern = useMemo(
    () => deriveLanternNarrative(journeyState),
    [journeyState],
  );
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const rememberedSet = scope === "witnessed-only" ? witnessedSet : visitedSet;
  const storyNodeMap = useMemo(
    () => new Map(storyModel.nodes.map((node) => [node.entryId, node])),
    [storyModel.nodes],
  );
  const entryMap = useMemo(() => new Map(entries.map((entry) => [entry.id, entry])), [entries]);
  const openRememberedEntry = onOpenEntry ?? onSelectEntry;
  const spatialNodes = useMemo(
    () => buildSpatialStoryNodes({ activeEntryId, entries, visitedEntryIds }),
    [activeEntryId, entries, visitedEntryIds],
  );
  const positions = useMemo(
    () => entries.map((entry) => entryWorldPosition(entry, entries)),
    [entries],
  );
  const projection = useMemo(() => fitWorldToMap(positions, MAP_SIZE, 34), [positions]);
  const nodeMap = useMemo(
    () => new Map(spatialNodes.map((node) => [node.entry.id, node])),
    [spatialNodes],
  );
  const activeNode = nodeMap.get(activeEntryId);
  const activeEntry = scope === "full" || witnessedSet.has(activeEntryId) ? activeNode?.entry : undefined;
  const activeChapter = activeEntry ? getJourneyChapterForEntry(activeEntryId) : undefined;
  const liveSceneProximity = sceneProximity?.activeEntryId === activeEntryId
    ? sceneProximity
    : null;
  const mapFallbackNavigationTarget = useMemo(
    () => scope === "witnessed-only" ? null : resolveNavigationTarget({
      nodes: spatialNodes,
      activeEntryId,
      visitedEntryIds,
      playerPosition: liveSceneProximity?.playerPosition ?? activeNode?.position ?? [0, 0, 0],
      cameraYaw: liveSceneProximity?.cameraYaw ?? 0,
    }),
    [
      activeEntryId,
      activeNode?.position,
      liveSceneProximity?.cameraYaw,
      liveSceneProximity?.playerPosition,
      spatialNodes,
      visitedEntryIds,
      scope,
    ],
  );
  const proposedNavigationTargetId =
    liveSceneProximity?.navigationTargetId ?? mapFallbackNavigationTarget?.entryId ?? null;
  const navigationTargetId = scope === "full" || proposedNavigationTargetId && witnessedSet.has(proposedNavigationTargetId)
    ? proposedNavigationTargetId : null;
  const navigationTargetReason =
    liveSceneProximity?.navigationTargetReason ?? mapFallbackNavigationTarget?.reason ?? "planned";
  const mapTrailState = liveSceneProximity?.trailState ?? "map-planned";
  const progressPercent = Math.round(
    (storyModel.progress.witnessedEntries / Math.max(1, STORY_CONSTELLATION_ENTRY_COUNT)) * 100,
  );
  const progressStyle = { "--progress": `${progressPercent}%` } as CSSProperties;
  const anonymousPoints = useMemo(() => scope === "witnessed-only"
    ? entries.filter(entry => !witnessedSet.has(entry.id)).map(entry => projection.project(entryWorldPosition(entry, entries)))
    : [], [entries, projection, scope, witnessedSet]);

  const chapterRegions = useMemo(() => {
    if (storyModel.isNearlyEmpty) return [];
    return storyModel.chapters.flatMap((chapter) => {
      const projected = chapter.visibleEntryIds.flatMap((entryId): SvgPoint[] => {
        const node = nodeMap.get(entryId);
        return node ? [projection.project(node.position)] : [];
      });
      if (projected.length === 0) return [];
      const seed = chapter.id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
      return [{
        ...chapter,
        path: expandedOrganicHullPath(projected, seed),
        tint: chapterTint(chapter.biome),
      }];
    });
  }, [nodeMap, projection, storyModel.chapters, storyModel.isNearlyEmpty]);

  const resonanceGlyphs = useMemo(() => {
    const integrationChapter = storyModel.chapters.find((chapter) => chapter.id === "wolf-swan-seer");
    const integrationPoints = (integrationChapter?.visibleEntryIds ?? []).flatMap((entryId): SvgPoint[] => {
      const node = nodeMap.get(entryId);
      return node ? [projection.project(node.position)] : [];
    });
    const anchor = integrationPoints.length > 0
      ? centroid(integrationPoints)
      : { x: MAP_SIZE * 0.5, y: MAP_SIZE * 0.5 };
    return storyModel.resonanceNodes
      .filter((node) => node.visible)
      .map((node) => ({
        ...node,
        point: {
          x: anchor.x + RESONANCE_OFFSETS[node.id].x,
          y: anchor.y + RESONANCE_OFFSETS[node.id].y,
        },
      }));
  }, [nodeMap, projection, storyModel.chapters, storyModel.resonanceNodes]);

  const releasedWordGlyphs = useMemo(() => {
    const releaseChapter = storyModel.chapters.find((chapter) => chapter.id === "fire-river");
    const releasePoints = (releaseChapter?.visibleEntryIds ?? []).flatMap((entryId): SvgPoint[] => {
      const node = nodeMap.get(entryId);
      return node ? [projection.project(node.position)] : [];
    });
    const anchor = releasePoints.length > 0
      ? centroid(releasePoints)
      : { x: MAP_SIZE * 0.5, y: MAP_SIZE * 0.58 };
    return storyModel.releasedWords.slice(-12).map((word, index) => {
      const angle = index * 2.399963 + word.length * 0.31;
      const radius = 18 + index * 8;
      return {
        id: `${word}:${index}`,
        word,
        point: {
          x: anchor.x + Math.cos(angle) * radius,
          y: anchor.y + Math.sin(angle) * radius * 0.72,
        },
        style: {
          "--release-delay": `${(-index * 1.17).toFixed(2)}s`,
          "--release-drift-x": `${(Math.cos(angle + 0.7) * 8).toFixed(1)}px`,
          "--release-drift-y": `${(-8 - (index % 3) * 4).toFixed(1)}px`,
        } as ConstellationVisualStyle,
      };
    });
  }, [nodeMap, projection, storyModel.chapters, storyModel.releasedWords]);

  const visibleStoryEntryIds = useMemo(
    () => new Set(storyModel.nodes.map((node) => node.entryId)),
    [storyModel.nodes],
  );
  const breadcrumbDots = useMemo(() => {
    if (storyModel.isNearlyEmpty) return [];
    const visible = breadcrumbTraces
      .filter((trace) => visibleStoryEntryIds.has(trace.activeEntryId))
      .slice(-120);
    return visible.map((trace, index) => {
      const point = projection.project(trace.position);
      const age = visible.length <= 1 ? 1 : index / (visible.length - 1);
      return {
        id: trace.id,
        point,
        kind: trace.kind,
        r: Number((1.1 + trace.scale * 0.72).toFixed(2)),
        opacity: Number(((0.06 + age * 0.2) * Math.max(0.34, trace.intensity)).toFixed(3)),
      };
    });
  }, [breadcrumbTraces, projection, storyModel.isNearlyEmpty, visibleStoryEntryIds]);

  const playerWorldPosition = liveSceneProximity?.playerPosition ?? activeNode?.position ?? null;
  const playerPoint = playerWorldPosition ? projection.project(playerWorldPosition) : null;
  const targetNode = navigationTargetId ? nodeMap.get(navigationTargetId) : undefined;
  const targetPoint = targetNode ? projection.project(targetNode.position) : null;
  const targetIsStoryNode = navigationTargetId
    ? visibleStoryEntryIds.has(navigationTargetId)
    : false;

  const listedEntries = useMemo(() => {
    const ids = [
      ...(navigationTargetId ? [navigationTargetId] : []),
      ...[...storyModel.routeEntryIds].reverse(),
      ...storyModel.nodes.map((node) => node.entryId),
    ];
    const selected: Slipper3DEntry[] = [];
    const seen = new Set<string>();
    for (const entryId of ids) {
      if (scope === "witnessed-only" && !witnessedSet.has(entryId)) continue;
      if (seen.has(entryId)) continue;
      const entry = entryMap.get(entryId);
      if (!entry) continue;
      seen.add(entryId);
      selected.push(entry);
      if (scope === "full" && selected.length >= 12) break;
    }
    return selected;
  }, [entryMap, navigationTargetId, scope, storyModel.nodes, storyModel.routeEntryIds, witnessedSet]);

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
    const unitScale = MAP_SIZE / rect.width;
    setViewport({
      ...drag.origin,
      x: drag.origin.x + ((event.clientX - drag.x) * unitScale) / drag.origin.scale,
      y: drag.origin.y + ((event.clientY - drag.y) * unitScale) / drag.origin.scale,
    });
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
    const nextScale = Math.max(
      MIN_ZOOM,
      Math.min(MAX_ZOOM, viewport.scale * Math.exp(-event.deltaY * 0.0018)),
    );
    const worldX = (point.x - viewport.x) / viewport.scale;
    const worldY = (point.y - viewport.y) / viewport.scale;
    setViewport({
      scale: nextScale,
      x: point.x - worldX * nextScale,
      y: point.y - worldY * nextScale,
    });
  };

  const resetMap = () => setViewport({ x: 0, y: 0, scale: 1 });
  const actionForEntry = (entryId: string) => {
    if (scope === "witnessed-only") {
      return witnessedSet.has(entryId) && useJourneyStore.getState().witnessedEntryIds.includes(entryId)
        ? openRememberedEntry : undefined;
    }
    return visitedSet.has(entryId) ? openRememberedEntry : onGuideEntry;
  };
  const activateEntry = (entryId: string) => actionForEntry(entryId)?.(entryId);
  const entryActionLabel = (entry: Slipper3DEntry) => {
    if (!rememberedSet.has(entry.id)) {
      return `Guide through the forest to unread fragment: ${entry.title}`;
    }
    if (entry.id === activeEntryId) {
      return `Read current remembered fragment: ${entry.title}`;
    }
    return `Return to remembered fragment: ${entry.title}`;
  };

  const renderStoryNode = (storyNode: ConstellationStoryNode) => {
    const spatialNode = nodeMap.get(storyNode.entryId);
    if (!spatialNode) return null;
    const point = projection.project(spatialNode.position);
    const isActive = storyNode.entryId === activeEntryId;
    const isTarget = storyNode.entryId === navigationTargetId;
    const actionAvailable = Boolean(actionForEntry(storyNode.entryId));
    const isKeyboardLandmark = isActive || isTarget;
    const entry = spatialNode.entry;
    const coreRadius = Number((2.2 + storyNode.intensity * 2.6).toFixed(2));
    const ringRadius = Number((coreRadius + (isActive ? 4.5 : isTarget ? 3.8 : 2.8)).toFixed(2));
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
        onClick={() => activateEntry(storyNode.entryId)}
        onKeyDown={(event) => {
          if (isKeyboardLandmark && (event.key === "Enter" || event.key === " ")) {
            event.preventDefault();
            activateEntry(storyNode.entryId);
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
    >
      <div className="constellation-header">
        <div>
          <p className="constellation-kicker">living memory constellation</p>
          <h2 className="constellation-title">{activeEntry?.title ?? "Unlit memory"}</h2>
          <span className="constellation-lantern-phase">{lantern.title}</span>
        </div>
        {scope === "full" ? <div className="constellation-progress" style={progressStyle}>
          <p className="constellation-progress-text">{progressPercent}% witnessed</p>
          <div className="constellation-progress-bar" aria-hidden="true">
            <span className="constellation-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </div> : null}
      </div>

      <p className="constellation-status" role="status">
        {scope === "witnessed-only" ? storyModel.nodes.length === 0
          ? "The constellation is almost dark."
          : "Witnessed memories remain in the constellation."
          : storyModel.isNearlyEmpty
          ? "The constellation is almost dark. One present point remains."
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
            {targetNode ? ` Guidance target: ${targetNode.entry.title}.` : ""}
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
                <circle className="constellation-resonance-halo" cx={node.point.x} cy={node.point.y} r={10 + node.intensity * 4} />
                <circle className="constellation-resonance-core" cx={node.point.x} cy={node.point.y} r={5.2 + node.intensity * 2.8} />
                <text className="constellation-resonance-label" x={node.point.x} y={node.point.y + 19}>{node.label}</text>
              </g>
            ))}

            <g className="constellation-released-words" aria-label={`${storyModel.releasedWordCount} released words in the constellation`}>
              {releasedWordGlyphs.map((word) => (
                <g
                  key={word.id}
                  className="constellation-released-word"
                  data-released-word={word.word}
                  style={word.style}
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
                className={`constellation-node constellation-node-button is-${biomeTone(getJourneySceneForEntry(targetNode.entry.id)?.biome)} is-guidance-ghost is-target`}
                role="button"
                tabIndex={actionForEntry(targetNode.entry.id) ? 0 : -1}
                data-keyboard-landmark="true"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => activateEntry(targetNode.entry.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activateEntry(targetNode.entry.id);
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

        {scope === "full" ? <div className="constellation-legend" aria-hidden="true">
          <span className="is-entry">{storyModel.progress.witnessedEntries}/66 witnessed</span>
          <span className="is-tag">{mapTrailState}</span>
          <span className="is-chapter">{storyModel.progress.completedChapters}/{journeyChapters.length} chapters</span>
          <span className="is-active">{lantern.id}</span>
        </div> : null}
      </div>

      {scope === "full" ? <div className="constellation-story-summary" aria-label="Constellation memory state">
        <span>{storyModel.progress.completedScenes}/32 scenes</span>
        <span>{storyModel.progress.completedRituals} story moments</span>
        <span>{storyModel.landmarkMemory.activeCount} landmarks</span>
        <span>{storyModel.releasedWordCount} words released</span>
      </div> : null}

      {scope === "full" || targetNode ? <div className="constellation-route-panel">
        <div>
          <p className="constellation-kicker">guidance target</p>
          <strong>{targetNode?.entry.title ?? "No target resolved"}</strong>
          <span>
            {targetNode
              ? getJourneyChapterForEntry(targetNode.entry.id)?.title ?? "A path still forming"
              : activeChapter?.title ?? "Open the forest to resolve a physical route."}
          </span>
        </div>
        <button
          type="button"
          disabled={!targetNode || !actionForEntry(targetNode.entry.id)}
          onClick={() => targetNode && activateEntry(targetNode.entry.id)}
          aria-label={targetNode ? entryActionLabel(targetNode.entry) : "No guidance target available"}
        >
          {targetNode && rememberedSet.has(targetNode.entry.id) ? "Read target" : "Guide me there"}
        </button>
      </div> : null}

      <div className="constellation-list">
        {listedEntries.map((entry) => {
          const storyNode = storyNodeMap.get(entry.id);
          const isActive = entry.id === activeEntryId;
          const isVisited = rememberedSet.has(entry.id);
          const isTarget = entry.id === navigationTargetId;
          const scene = getJourneySceneForEntry(entry.id);
          const actionAvailable = Boolean(actionForEntry(entry.id));
          return (
            <button
              key={entry.id}
              type="button"
              onClick={() => activateEntry(entry.id)}
              disabled={!actionAvailable}
              className={`constellation-row${isActive ? " is-active" : ""}${isTarget ? " is-target" : ""}${isVisited ? " is-visited" : " is-unvisited"}`}
              aria-current={isActive ? "location" : undefined}
              aria-label={entryActionLabel(entry)}
            >
              <span className={`constellation-row-dot is-${biomeTone(scene?.biome)}`} aria-hidden="true" />
              <span>
                <strong>{shortTitle(entry.title, 36)}</strong>
                <small>{getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}</small>
              </span>
              <em>
                {isActive
                  ? "present"
                  : isTarget
                    ? "guidance"
                    : storyNode?.stage ?? (isVisited ? "travelled" : "unread")}
              </em>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ConstellationMap;
