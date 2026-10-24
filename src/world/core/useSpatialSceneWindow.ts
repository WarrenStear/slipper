import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, useState } from "react";
import type { JourneySceneId } from "../../data/journeyWorldLayout";
import { resolveSpatialSceneWindow, SCENE_STREAM_CELL_SIZE } from "./sceneStreaming";

/** Publish a bounded scenery window on cell changes, never on every camera frame. */
export function useSpatialSceneWindow(activeSceneId: JourneySceneId, quality: string, reducedEffects: boolean, enabled: boolean) {
  const { camera } = useThree();
  const [ids, setIds] = useState<JourneySceneId[]>(() => [activeSceneId]);
  const previous = useRef(ids), signature = useRef("");
  useEffect(() => { signature.current = ""; }, [activeSceneId, quality, reducedEffects, enabled]);
  useFrame(() => {
    const x = camera.position.x, z = camera.position.z;
    const nextSignature = `${Math.floor(x / SCENE_STREAM_CELL_SIZE)}:${Math.floor(z / SCENE_STREAM_CELL_SIZE)}:${activeSceneId}:${quality}:${reducedEffects}:${enabled}`;
    if (signature.current === nextSignature) return;
    signature.current = nextSignature;
    const next = enabled ? resolveSpatialSceneWindow({ x, z, activeSceneId, quality, reducedEffects, previous: previous.current }) : [activeSceneId];
    if (next.join("|") === previous.current.join("|")) return;
    previous.current = next;
    setIds(next);
  });
  // The enclosed opening owns its room; outdoor residency follows position.
  return enabled ? ids : [activeSceneId];
}
