import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { resolveAudioTargetVolume } from "../../../lib/audioVolume";
import { getGestureActivatedNarrativeAudioContext } from "../../../lib/narrativeAudioActivation";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { useStoryEventAudio } from "./useStoryEventAudio";
import type { RenderQualityProfile } from "../renderQuality";
import {
  NARRATIVE_AUDIO_STEM_IDS,
  resolveNarrativeAudioProfile,
  type NarrativeAudioStemId,
} from "./narrativeAudioProfiles";

type StemRuntime = {
  id: NarrativeAudioStemId;
  sound: THREE.Audio;
  volume: number;
  filter: BiquadFilterNode;
};

type NarrativeAudioDirectorProps = {
  qualityProfile: RenderQualityProfile;
  enabled?: boolean;
};

function seededNoise(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

function createStemBuffer(context: AudioContext, stemId: NarrativeAudioStemId) {
  const duration = stemId === "glass" ? 6.4 : stemId === "birds" ? 7.6 : 4.2;
  const sampleRate = context.sampleRate;
  const buffer = context.createBuffer(1, Math.floor(sampleRate * duration), sampleRate);
  const data = buffer.getChannelData(0);
  const random = seededNoise(0x51d700 + NARRATIVE_AUDIO_STEM_IDS.indexOf(stemId) * 7919);
  let low = 0;
  let slower = 0;
  let impulse = 0;

  for (let index = 0; index < data.length; index += 1) {
    const t = index / sampleRate;
    const noise = random() * 2 - 1;
    low += (noise - low) * (stemId === "water" ? 0.025 : 0.012);
    slower += (low - slower) * 0.004;

    if (stemId === "room") {
      data[index] = slower * (0.42 + Math.sin(t * 0.31) * 0.05);
    } else if (stemId === "wind") {
      data[index] = (slower * 0.78 + low * 0.11) * (0.58 + Math.sin(t * 0.73) * 0.13);
    } else if (stemId === "water") {
      data[index] = low * 0.36 + slower * 0.44 + Math.sin(t * Math.PI * 2 * 1.9) * 0.004;
    } else if (stemId === "fire") {
      if (random() > 0.987) impulse = 0.65 + random() * 0.55;
      impulse *= 0.91;
      data[index] = (noise * impulse + Math.sin(t * Math.PI * 2 * 24) * 0.025) * 0.2;
    } else if (stemId === "glass") {
      if (index % Math.floor(sampleRate * 1.61) === 0) impulse = 0.7;
      impulse *= 0.9997;
      data[index] = (
        Math.sin(t * Math.PI * 2 * 523.25) * 0.035 +
        Math.sin(t * Math.PI * 2 * 783.99) * 0.018
      ) * impulse;
    } else if (stemId === "warmth") {
      const breathe = 0.52 + Math.sin(t * Math.PI * 2 * 0.11) * 0.18;
      data[index] = (
        Math.sin(t * Math.PI * 2 * 110) * 0.028 +
        Math.sin(t * Math.PI * 2 * 164.81) * 0.014
      ) * breathe;
    } else if (stemId === "birds") {
      const call = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.19 - 1.4)), 18);
      const overtone = Math.sin(t * Math.PI * 2 * (1_720 + Math.sin(t * 5.1) * 210));
      data[index] = overtone * call * 0.018;
    } else if (stemId === "cloth") {
      const movement = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.23)), 6);
      data[index] = (low * 0.12 + noise * 0.018) * movement;
    } else if (stemId === "wood") {
      if (random() > 0.9992) impulse = 0.72;
      impulse *= 0.9982;
      data[index] = (
        Math.sin(t * Math.PI * 2 * 73.42) * 0.025 +
        Math.sin(t * Math.PI * 2 * 109.8) * 0.012
      ) * impulse;
    } else {
      const phrase = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 0.29 + 0.8)), 5);
      data[index] = (low * 0.07 + Math.sin(t * Math.PI * 2 * 246.94) * 0.008) * phrase;
    }
  }
  return buffer;
}

export function NarrativeAudioDirector({ qualityProfile, enabled = true }: NarrativeAudioDirectorProps) {
  const { camera } = useThree();
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const audioVolume = useSettingsStore((state) => state.audioVolume);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const chapterId = useJourneyStore((state) => state.chapterId);
  const sceneId = useJourneyStore((state) => state.sceneId);
  const resonances = useJourneyStore((state) => state.resonances);
  const releasedWords = useJourneyStore((state) => state.releasedWords);
  const surrenderComplete = useJourneyStore((state) =>
    state.completedRitualIds.includes("ritual.surrender")
  );
  const listener = useMemo(() => {
    const gestureContext = getGestureActivatedNarrativeAudioContext();
    if (gestureContext) THREE.AudioContext.setContext(gestureContext);
    return new THREE.AudioListener();
  }, []);
  const startedRef = useRef(false);
  const eventAmbientGain = useStoryEventAudio({ listener, enabled: enabled && audioEnabled, audioVolume, reducedEffects, reducedMotion });
  const profile = useMemo(
    () => resolveNarrativeAudioProfile({ chapterId, sceneId, resonances, releasedWords, surrenderComplete }),
    [chapterId, releasedWords, resonances, sceneId, surrenderComplete],
  );
  const stems = useMemo<StemRuntime[]>(
    () => NARRATIVE_AUDIO_STEM_IDS.map((id) => {
      const filter = listener.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 18000;
      const sound = new THREE.Audio(listener);
      sound.setFilter(filter);
      return { id, sound, volume: 0, filter };
    }),
    [listener],
  );

  useEffect(() => {
    camera.add(listener);
    return () => {
      camera.remove(listener);
    };
  }, [camera, listener]);

  useEffect(() => {
    stems.forEach((stem) => {
      stem.sound.setBuffer(createStemBuffer(listener.context, stem.id));
      stem.sound.setLoop(true);
      stem.sound.setVolume(0);
    });

    const start = async () => {
      if (!enabled || !audioEnabled) return;
      try {
        if (listener.context.state !== "running") await listener.context.resume();
        stems.forEach((stem) => {
          if (!stem.sound.isPlaying) stem.sound.play();
        });
        startedRef.current = true;
      } catch {
        // The trusted-gesture listeners remain available when autoplay is denied.
      }
    };
    const handleGesture = (event: Event) => { if (event.isTrusted) void start(); };

    if (audioEnabled && getGestureActivatedNarrativeAudioContext()?.state === "running") void start();
    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });
    return () => {
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      stems.forEach((stem) => {
        if (stem.sound.isPlaying) stem.sound.stop();
        stem.sound.disconnect();
      });
      startedRef.current = false;
    };
  }, [audioEnabled, enabled, listener.context, stems]);

  useFrame((_, delta) => {
    const film = getCurrentCinematicProfile();
    const audible = enabled && audioEnabled && startedRef.current;
    const qualityScale = qualityProfile.quality === "low"
      ? 0.56
      : qualityProfile.quality === "medium"
        ? 0.78
        : 1;
    const blend = 1 - Math.exp(-Math.min(delta, 0.08) * 1.8);
    stems.forEach((stem) => {
      const requested = profile.stems[stem.id] * profile.master * qualityScale * film.audioPressure * (1 - film.silenceBias);
      const target = resolveAudioTargetVolume(requested, audioVolume, audible);
      stem.volume = THREE.MathUtils.lerp(stem.volume, target, blend);
      const outside = stem.id === "wind" || stem.id === "birds" || stem.id === "water";
      stem.filter.frequency.value = THREE.MathUtils.lerp(stem.filter.frequency.value, outside ? film.lowpassHz : Math.max(5000, film.lowpassHz), blend);
      stem.sound.setVolume(stem.volume * eventAmbientGain.current);
    });
  });

  return (
    <group name="NarrativeAudioDirector" userData={{ audioCue: profile.cue }}>
      {stems.map((stem) => (
        <primitive key={stem.id} object={stem.sound} name={`NarrativeAudioStem.${stem.id}`} />
      ))}
    </group>
  );
}

export default NarrativeAudioDirector;
