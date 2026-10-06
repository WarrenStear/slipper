import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  INTERACTION_SAMPLE_INTERVAL, detectInteractionProximity, observedThresholdEntry,
  type InteractionProximity, type PhysicalInteractionTarget,
} from "./interactionProximity";

/** Reports physical observations; the receiving narrative layer accepts or rejects travel. */
export function InteractionController({ enabled, targets, clearingRadius, onSample, onTargetEntered }: {
  enabled: boolean; targets: readonly PhysicalInteractionTarget[]; clearingRadius: number;
  onSample: (facts: InteractionProximity, elapsedTime: number) => void;
  onTargetEntered?: (id: string) => void;
}) {
  const { camera } = useThree();
  const lastSpatialCalcTimeRef = useRef(Number.NEGATIVE_INFINITY);
  const lastEnteredNodeRef = useRef<string | null>(null);
  const cameraDirectionRef = useRef(new Vector3());
  useFrame(({ clock }) => {
    if (!enabled || targets.length === 0) return;
    if (clock.elapsedTime - lastSpatialCalcTimeRef.current < INTERACTION_SAMPLE_INTERVAL) return;
    lastSpatialCalcTimeRef.current = clock.elapsedTime;
    camera.getWorldDirection(cameraDirectionRef.current);
    const facts = detectInteractionProximity(targets, [camera.position.x, camera.position.y, camera.position.z],
      Math.atan2(cameraDirectionRef.current.x, cameraDirectionRef.current.z), clearingRadius);
    onSample(facts, clock.elapsedTime);
    const entry = observedThresholdEntry(facts.nearestInactive, lastEnteredNodeRef.current);
    lastEnteredNodeRef.current = entry.lastEnteredId;
    if (entry.enteredId) onTargetEntered?.(entry.enteredId);
  });
  return null;
}
