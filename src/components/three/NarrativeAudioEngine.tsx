import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { NarrativeWorldState } from "./StoryScene";
import type { RenderQualityProfile } from "./renderQuality";
import {
  AUDIO_ENABLED_EVENT,
  AUDIO_ENABLED_STORAGE_KEY,
  getAudioEnabledPreference,
} from "../../lib/experiencePreferences";
import { resolveAudioTargetVolume } from "../../lib/audioVolume";
import { useSettingsStore } from "../../stores/useSettingsStore";

type AudioStemId = "fire" | "wind" | "whisper";

type AudioStemRuntime = {
  id: AudioStemId;
  sound: THREE.PositionalAudio;
  targetVolume: number;
  currentVolume: number;
  localPosition: THREE.Vector3;
};

type NarrativeAudioEngineProps = {
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  enabled?: boolean;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smootherstep(edge0: number, edge1: number, value: number) {
  const t = clamp01((value - edge0) / Math.max(0.0001, edge1 - edge0));
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function seededNoise(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0xffffffff;
  };
}

function createCrackleBuffer(context: AudioContext) {
  const duration = 2.8;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededNoise(0x51d7f1e);

  let burst = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    if (random() > 0.986) burst = 0.9 + random() * 0.65;
    burst *= 0.91;
    const emberPulse = Math.sin(t * Math.PI * 2 * (18 + random() * 12)) * 0.08;
    data[index] = ((random() * 2 - 1) * burst + emberPulse) * 0.18;
  }

  return buffer;
}

function createWindBuffer(context: AudioContext) {
  const duration = 5.2;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededNoise(0xc01d51d7);

  let low = 0;
  let mid = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    const noise = random() * 2 - 1;
    low += (noise - low) * 0.018;
    mid += (low - mid) * 0.006;
    const breathingGust = 0.55 + Math.sin(t * Math.PI * 2 * 0.13) * 0.18 + Math.sin(t * Math.PI * 2 * 0.041) * 0.12;
    data[index] = (mid * 0.72 + low * 0.18) * breathingGust;
  }

  return buffer;
}

function createWhisperBuffer(context: AudioContext) {
  const duration = 6.4;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededNoise(0x7a11c0de);

  let breath = 0;
  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    const phraseA = Math.sin(t * Math.PI * 2 * (220 + Math.sin(t * 0.7) * 18));
    const phraseB = Math.sin(t * Math.PI * 2 * (330 + Math.cos(t * 0.43) * 26));
    const mouthNoise = random() * 2 - 1;
    breath += (mouthNoise - breath) * 0.035;
    const gate = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.37 + 0.8)), 4);
    data[index] = (phraseA * 0.024 + phraseB * 0.014 + breath * 0.08) * gate;
  }

  return buffer;
}

function prepareStem(stem: AudioStemRuntime, buffer: AudioBuffer) {
  stem.sound.setBuffer(buffer);
  stem.sound.setLoop(true);
  stem.sound.setVolume(0);
  stem.sound.setRefDistance(1.8);
  stem.sound.setRolloffFactor(0.85);
  stem.sound.setDistanceModel("exponential");
}

export function NarrativeAudioEngine({ narrativeWorldState, qualityProfile, enabled = true }: NarrativeAudioEngineProps) {
  const { camera } = useThree();
  const audioVolume = useSettingsStore((state) => state.audioVolume);
  const rootRef = useRef<THREE.Group>(null);
  const startedRef = useRef(false);
  const preferenceEnabledRef = useRef(getAudioEnabledPreference());
  const listener = useMemo(() => new THREE.AudioListener(), []);
  const stems = useMemo<AudioStemRuntime[]>(() => {
    const fire = new THREE.PositionalAudio(listener);
    const wind = new THREE.PositionalAudio(listener);
    const whisper = new THREE.PositionalAudio(listener);

    return [
      {
        id: "fire",
        sound: fire,
        targetVolume: 0,
        currentVolume: 0,
        localPosition: new THREE.Vector3(1.15, -0.75, -1.35),
      },
      {
        id: "wind",
        sound: wind,
        targetVolume: 0,
        currentVolume: 0,
        localPosition: new THREE.Vector3(-3.8, 1.1, -2.4),
      },
      {
        id: "whisper",
        sound: whisper,
        targetVolume: 0,
        currentVolume: 0,
        localPosition: new THREE.Vector3(0, 1.45, -3.1),
      },
    ];
  }, [listener]);

  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);

  useEffect(() => {
    prepareStem(stems[0], createCrackleBuffer(listener.context));
    prepareStem(stems[1], createWindBuffer(listener.context));
    prepareStem(stems[2], createWhisperBuffer(listener.context));

    const stopAudio = () => {
      stems.forEach((stem) => {
        stem.targetVolume = 0;
        stem.currentVolume = 0;
        stem.sound.setVolume(0);
      });
    };

    const startAudio = async () => {
      if (!enabled || !preferenceEnabledRef.current) {
        stopAudio();
        return;
      }

      try {
        if (listener.context.state !== "running") {
          await listener.context.resume();
        }
        stems.forEach((stem) => {
          if (!stem.sound.isPlaying) stem.sound.play();
        });
        startedRef.current = true;
      } catch {
        // Browsers may block audio until a trusted gesture. The event listeners remain available.
      }
    };

    const handleGesture = () => {
      void startAudio();
    };

    const handleAudioPreference = (event: Event) => {
      const nextEnabled = (event as CustomEvent<{ enabled?: unknown }>).detail?.enabled;
      preferenceEnabledRef.current = nextEnabled === true;
      if (preferenceEnabledRef.current) void startAudio();
      else stopAudio();
    };

    const handleStorage = (event: StorageEvent) => {
      if (event.key !== AUDIO_ENABLED_STORAGE_KEY) return;
      preferenceEnabledRef.current = event.newValue === "true";
      if (!preferenceEnabledRef.current) stopAudio();
    };

    if (preferenceEnabledRef.current) {
      void startAudio();
    }

    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });
    window.addEventListener(AUDIO_ENABLED_EVENT, handleAudioPreference);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener(AUDIO_ENABLED_EVENT, handleAudioPreference);
      window.removeEventListener("storage", handleStorage);
      stems.forEach((stem) => {
        if (stem.sound.isPlaying) stem.sound.stop();
      });
    };
  }, [enabled, listener.context, stems]);

  useFrame((_, delta) => {
    if (!rootRef.current) return;

    rootRef.current.position.copy(camera.position);
    rootRef.current.quaternion.copy(camera.quaternion);

    const audioEnabled = enabled && preferenceEnabledRef.current;
    const qualityAudioScale = qualityProfile.quality === "low" ? 0.55 : qualityProfile.quality === "medium" ? 0.78 : 1;
    const fireBias = clamp01(narrativeWorldState.fireWaterBalance);
    const waterBias = clamp01(-narrativeWorldState.fireWaterBalance);
    const pressure = clamp01(narrativeWorldState.memoryPressure);
    const depth = clamp01(narrativeWorldState.explorationDepth);

    const targets: Record<AudioStemId, number> = {
      fire: smootherstep(0.05, 0.85, fireBias) * 0.26,
      wind: (smootherstep(0.04, 0.9, waterBias) * 0.22 + depth * 0.035) * (1 - fireBias * 0.28),
      whisper: (smootherstep(0.34, 0.96, pressure) * 0.24 + narrativeWorldState.symbolicWeight * 0.018) * (0.72 + depth * 0.28),
    };

    const ramp = 1 - Math.exp(-delta * 2.8);
    stems.forEach((stem) => {
      const targetVolume = resolveAudioTargetVolume(
        targets[stem.id] * qualityAudioScale,
        audioVolume,
        audioEnabled,
      );
      stem.targetVolume = targetVolume;
      stem.currentVolume = THREE.MathUtils.lerp(stem.currentVolume, targetVolume, ramp);
      stem.sound.position.copy(stem.localPosition);
      stem.sound.setVolume(stem.currentVolume);
    });
  });

  return (
    <group ref={rootRef} name="NarrativeAudioEngine">
      {stems.map((stem) => (
        <primitive key={stem.id} object={stem.sound} name={`NarrativeAudioStem.${stem.id}`} />
      ))}
    </group>
  );
}

export default NarrativeAudioEngine;
