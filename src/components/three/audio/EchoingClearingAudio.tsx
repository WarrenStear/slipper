import { PositionalAudio } from "@react-three/drei";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useStillnessState } from "../../../hooks/useStillnessState";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useWorldStore } from "../../../stores/useWorldStore";

export type EchoingClearingAudioProps = {
  enabled?: boolean;
};

const ECHO_BANK = [
  "/audio/echoes/ash-breath.ogg",
  "/audio/echoes/water-memory.ogg",
  "/audio/echoes/wood-whisper.ogg",
];

export function EchoingClearingAudio({ enabled = true }: EchoingClearingAudioProps) {
  const audioRef = useRef<THREE.PositionalAudio>(null);
  const visitedEntryIds = useJourneyStore((state) => state.visitedEntryIds);
  const sceneProximity = useWorldStore((state) => state.sceneProximity);
  const isStill = useStillnessState({ stillSpeed: 0.02, requiredSeconds: 2.8 });

  const echoUrl = useMemo(() => ECHO_BANK[visitedEntryIds.length % ECHO_BANK.length], [visitedEntryIds.length]);
  const echoPosition = sceneProximity?.activeWorldPosition ?? sceneProximity?.nearestWorldPosition ?? [0, 0.8, 0];

  useEffect(() => {
    const sound = audioRef.current;
    if (!sound || !enabled) return;
    sound.setRefDistance(2.2);
    sound.setRolloffFactor(1.4);
    sound.setDistanceModel("exponential");
    sound.setLoop(false);
    sound.setVolume(0.22);
  }, [enabled, echoUrl]);

  useEffect(() => {
    const sound = audioRef.current;
    if (!sound || !enabled || !isStill) return;
    if (!sound.isPlaying) sound.play();
  }, [enabled, isStill, visitedEntryIds.length]);

  if (!enabled) return null;

  return (
    <group position={echoPosition} name="EchoingClearingAudio">
      <PositionalAudio ref={audioRef} url={echoUrl} distance={8} loop={false} autoplay={false} />
    </group>
  );
}
