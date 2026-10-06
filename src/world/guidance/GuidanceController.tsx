import { useCallback, useEffect, useMemo, useRef } from "react";
import { InteractionController } from "../../player/InteractionController";
import { NODE_ACTIVATION_RADIUS, type InteractionProximity } from "../../player/interactionProximity";
import type { ExperienceMode, PlayerControls } from "../../player/playerTypes";
import { nearestPathStatus, resolveNavigationTarget } from "../../lib/navigationResolver";
import type { MazePathSegment } from "../terrain/worldPaths";
import type { SpatialStoryNode } from "../terrain/worldPlacement";
import type { PlayerSpatialWindow, SceneProximityState } from "./guidanceTypes";

const PROXIMITY_UI_UPDATE_INTERVAL = 0.2;
const PLAYER_SPATIAL_CELL_SIZE = 6;
const NODE_APPROACH_RADIUS = 11.5;
const CLEARING_SAFE_RADIUS = 8.8;

/** Interprets physical facts as a route; it cannot apply a story consequence. */
export function GuidanceController({ nodes, pathSegments, visitedEntryIds, lockedEntryIds, explicitNavigationTargetId,
  controls, mode, onNodeEnter, onApproachChange, onPlayerProximityChange, onPlayerSpatialChange, onPhysicalPresence }: {
  nodes: SpatialStoryNode[]; pathSegments: MazePathSegment[]; visitedEntryIds: string[]; lockedEntryIds: readonly string[];
  explicitNavigationTargetId?: string | null; controls: PlayerControls; mode: ExperienceMode;
  onNodeEnter?: (id: string) => boolean | void; onApproachChange?: (id: string | null) => void;
  onPlayerProximityChange?: (state: SceneProximityState) => void; onPlayerSpatialChange?: (state: PlayerSpatialWindow) => void;
  onPhysicalPresence?: (facts: InteractionProximity) => void;
}) {
  const lastApproachRef = useRef<string | null>(null);
  const lastUiSignatureRef = useRef("");
  const lastSpatialSignatureRef = useRef("");
  const lastUpdateTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lockedEntryIdSet = useMemo(() => new Set(lockedEntryIds), [lockedEntryIds]);
  const nodesById = useMemo(() => new Map(nodes.map(node => [node.entry.id, node])), [nodes]);
  const targets = useMemo(() => nodes.map(node => ({ id: node.entry.id, position: node.position, active: node.isActive })), [nodes]);
  const availableNavigationNodes = useMemo(() => nodes.filter(node => !lockedEntryIdSet.has(node.entry.id)), [lockedEntryIdSet, nodes]);
  const explicitNavigationTargetNode = explicitNavigationTargetId && !lockedEntryIdSet.has(explicitNavigationTargetId)
    ? nodesById.get(explicitNavigationTargetId) : undefined;

  useEffect(() => { lastApproachRef.current = null; lastSpatialSignatureRef.current = ""; onApproachChange?.(null); }, [nodes, onApproachChange]);

  const interpretPhysicalSample = useCallback((facts: InteractionProximity, now: number) => {
    onPhysicalPresence?.(facts);
    const { playerPosition, cameraYaw, insideClearing } = facts;
    const activeNode = facts.active ? nodesById.get(facts.active.id) : undefined;
    const closestNode = facts.nearest ? nodesById.get(facts.nearest.id) : undefined;
    const closestInactiveNode = facts.nearestInactive ? nodesById.get(facts.nearestInactive.id) : undefined;
    const closestDistance = facts.nearest?.distance ?? Number.POSITIVE_INFINITY;
    const pathStatus = nearestPathStatus({ playerPosition, pathSegments, insideClearing });
    const automaticNavigationTarget = explicitNavigationTargetNode ? null : resolveNavigationTarget({
      nodes: availableNavigationNodes, activeEntryId: activeNode?.entry.id ?? "", visitedEntryIds, playerPosition, cameraYaw,
    });
    const navigationTargetNode = explicitNavigationTargetNode ?? (automaticNavigationTarget ? nodesById.get(automaticNavigationTarget.entryId) : undefined);
    const navigationTargetDistance = explicitNavigationTargetNode
      ? Math.hypot(explicitNavigationTargetNode.position[0] - playerPosition[0], explicitNavigationTargetNode.position[2] - playerPosition[2])
      : (automaticNavigationTarget?.distance ?? 999);
    const navigationTargetId = explicitNavigationTargetNode?.entry.id ?? automaticNavigationTarget?.entryId ?? null;
    const navigationTargetTitle = explicitNavigationTargetNode?.entry.title ?? automaticNavigationTarget?.title ?? null;
    const navigationTargetPosition = explicitNavigationTargetNode?.position ?? automaticNavigationTarget?.position ?? null;
    const navigationTargetReason = explicitNavigationTargetNode
      ? explicitNavigationTargetNode.isVisited ? "return" : "unvisited"
      : (automaticNavigationTarget?.reason ?? null);
    const approachingNode = navigationTargetNode ?? closestInactiveNode;
    const approachingDistance = navigationTargetNode ? navigationTargetDistance : (facts.nearestInactive?.distance ?? 999);
    const basePresence = closestNode ? Math.max(0, Math.min(1, 1 - Math.max(0, closestDistance - NODE_ACTIVATION_RADIUS) / NODE_APPROACH_RADIUS)) : 0;
    const trailPresence = pathStatus.state === "lost" ? .86 : pathStatus.state === "edge-of-trail" ? .62 : .22;
    const uiPresence = insideClearing ? 1 : Math.max(basePresence, trailPresence);
    const proximityState: SceneProximityState = {
      activeEntryId: activeNode?.entry.id ?? "", nearestEntryId: closestNode?.entry.id ?? null, nearestTitle: closestNode?.entry.title ?? null,
      distance: closestNode ? closestDistance : 999, uiPresence, insideClearing, playerPosition,
      activeWorldPosition: activeNode?.position ?? null, nearestWorldPosition: closestNode?.position ?? null,
      approachingEntryId: approachingNode?.entry.id ?? null, approachingTitle: approachingNode?.entry.title ?? null,
      approachingDistance, approachingWorldPosition: approachingNode?.position ?? null, cameraYaw,
      navigationTargetId, navigationTargetTitle, navigationTargetWorldPosition: navigationTargetPosition,
      navigationTargetDistance, navigationTargetReason, nearestPathDistance: pathStatus.distance, trailState: pathStatus.state,
    };
    const signature = `${proximityState.nearestEntryId}:${proximityState.navigationTargetId}:${proximityState.trailState}:${Math.round(proximityState.distance * 10)}:${Math.round(proximityState.nearestPathDistance * 10)}:${Math.round(proximityState.cameraYaw * 10)}:${Math.round(proximityState.uiPresence * 100)}`;
    const canPublishUiUpdate = now - lastUpdateTimeRef.current >= PROXIMITY_UI_UPDATE_INTERVAL;
    if (signature !== lastUiSignatureRef.current && canPublishUiUpdate) {
      lastUiSignatureRef.current = signature; lastUpdateTimeRef.current = now; onPlayerProximityChange?.(proximityState);
    }
    // UI keeps its cadence; forest culling receives only coarse spatial changes.
    const spatialSignature = `${navigationTargetId}:${Math.round(playerPosition[0] / PLAYER_SPATIAL_CELL_SIZE)}:${Math.round(playerPosition[2] / PLAYER_SPATIAL_CELL_SIZE)}`;
    if (spatialSignature !== lastSpatialSignatureRef.current) {
      lastSpatialSignatureRef.current = spatialSignature;
      onPlayerSpatialChange?.({ position: playerPosition, cameraYaw, navigationTargetId, nearestPathDistance: pathStatus.distance, trailState: pathStatus.state });
    }
    const approachingId = navigationTargetId && navigationTargetDistance < NODE_APPROACH_RADIUS * 1.65
      ? navigationTargetId : closestInactiveNode && (facts.nearestInactive?.distanceSq ?? Infinity) < NODE_APPROACH_RADIUS * NODE_APPROACH_RADIUS
        ? closestInactiveNode.entry.id : null;
    if (approachingId !== lastApproachRef.current) { lastApproachRef.current = approachingId; onApproachChange?.(approachingId); }
  }, [availableNavigationNodes, explicitNavigationTargetNode, nodesById, onApproachChange, onPlayerProximityChange, onPlayerSpatialChange, onPhysicalPresence, pathSegments, visitedEntryIds]);

  return <InteractionController enabled={mode === "explore" && controls === "walk"} targets={targets}
    clearingRadius={CLEARING_SAFE_RADIUS} onSample={interpretPhysicalSample} onTargetEntered={onNodeEnter} />;
}
