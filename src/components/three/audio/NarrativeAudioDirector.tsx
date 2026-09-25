import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { resolveAudioTargetVolume } from "../../../lib/audioVolume";
import { getGestureActivatedNarrativeAudioContext, NARRATIVE_AUDIO_ACTIVATION_EVENT } from "../../../lib/narrativeAudioActivation";
import { getCurrentCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { getJourneyScene } from "../../../data/journeyBlueprint";
import { useSceneLook } from "../artDirection/SceneLookContext";
import { useStoryEventAudio } from "./useStoryEventAudio";
import { createNarrativePlaybackGate, disposeNarrativeAudioNodes, getNarrativeStemBuffers, pauseNarrativeAudioNodes } from "./narrativeAudioRuntime";
import type { RenderQualityProfile } from "../renderQuality";
import {
  NARRATIVE_AUDIO_STEM_IDS,
  resolveNarrativeAudioProfile,
  resolveNarrativeStemTarget,
  type NarrativeAudioStemId,
} from "./narrativeAudioProfiles";

type StemRuntime = {
  id: NarrativeAudioStemId;
  sound: THREE.Audio;
  volume: number;
  filter: BiquadFilterNode;
};
type AudioRuntime = { listener: THREE.AudioListener; stems: StemRuntime[]; started: boolean; sync: () => void };
type NarrativeAudioDirectorProps = { qualityProfile: RenderQualityProfile; enabled?: boolean };

export function NarrativeAudioDirector({ qualityProfile, enabled = true }: NarrativeAudioDirectorProps) {
  const { camera } = useThree();
  const presentation = useSceneLook();
  const audioEnabled = useSettingsStore((state) => state.audioEnabled);
  const audioVolume = useSettingsStore((state) => state.audioVolume);
  const reducedEffects = useSettingsStore((state) => state.reducedEffects);
  const reducedMotion = useSettingsStore((state) => state.reducedMotion);
  const drawerOpen = useSettingsStore((state) => state.drawerOpen);
  const chapterId = useJourneyStore((state) => state.chapterId);
  const journeySceneId = useJourneyStore((state) => state.sceneId);
  const resonances = useJourneyStore((state) => state.resonances);
  const releasedWords = useJourneyStore((state) => state.releasedWords);
  const surrenderComplete = useJourneyStore((state) => state.completedRitualIds.includes("ritual.surrender"));
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const [runtime, setRuntime] = useState<AudioRuntime | null>(null);
  const runtimeRef = useRef<AudioRuntime | null>(null);
  const targetRef = useRef({ volume: 0, lowpassHz: 600 });
  const sceneId = presentation?.look.sceneId ?? journeySceneId;
  const sceneChapterId = getJourneyScene(sceneId)?.chapterId ?? chapterId;
  // SceneLook owns the completed Surrender fade. Do not jump the profile master to zero.
  const profileComplete = presentation ? false : surrenderComplete;
  const profile = useMemo(
    () => resolveNarrativeAudioProfile({ chapterId: sceneChapterId, sceneId, resonances, releasedWords, surrenderComplete: profileComplete }),
    [sceneChapterId, releasedWords, resonances, sceneId, profileComplete],
  );
  const eventAmbientGain = useStoryEventAudio({
    listener: runtime?.listener ?? null, enabled: enabled && audioEnabled && !drawerOpen,
    audioVolume, reducedEffects, reducedMotion, sceneLookOwnsSurrender: Boolean(presentation),
  });

  useEffect(() => {
    // Web Audio nodes are effect-owned: discarded StrictMode renders allocate nothing.
    const gestureContext = getGestureActivatedNarrativeAudioContext();
    if (gestureContext) THREE.AudioContext.setContext(gestureContext);
    const listener = new THREE.AudioListener();
    listener.getInput().gain.setValueAtTime(0, listener.context.currentTime);
    const bank = getNarrativeStemBuffers(listener.context);
    const stems: StemRuntime[] = NARRATIVE_AUDIO_STEM_IDS.map(id => {
      const filter = listener.context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 600;
      const sound = new THREE.Audio(listener);
      sound.setFilter(filter);
      sound.setBuffer(bank.get(id)!);
      sound.setLoop(true);
      sound.setVolume(0);
      return { id, sound, filter, volume: 0 };
    });
    const current: AudioRuntime = { listener, stems, started: false, sync: () => {} };
    const allowed = () => {
      const settings = useSettingsStore.getState();
      return enabledRef.current && settings.audioEnabled && settings.audioVolume > 0 && !settings.drawerOpen && !document.hidden;
    };
    const gate = createNarrativePlaybackGate({
      allowed,
      running: () => listener.context.state === "running",
      resume: () => listener.context.resume(),
      play: () => {
        for (const stem of stems) if (!stem.sound.isPlaying) stem.sound.play();
        current.started = true;
        listener.setMasterVolume(1);
      },
      pause: () => {
        // Visibility and mute do not depend on requestAnimationFrame continuing to run.
        pauseNarrativeAudioNodes(listener, stems);
        current.started = false;
      },
      dispose: () => disposeNarrativeAudioNodes(listener, stems),
    });
    current.sync = () => {
      if (!allowed()) gate.pause();
      else if (getGestureActivatedNarrativeAudioContext() === listener.context && listener.context.state === "running") void gate.start();
    };
    const handleGesture = (event: Event) => { if (event.isTrusted) void gate.start(); };
    const unsubscribe = useSettingsStore.subscribe(current.sync);
    camera.add(listener);
    runtimeRef.current = current;
    setRuntime(current);
    current.sync();
    window.addEventListener("pointerdown", handleGesture, { passive: true });
    window.addEventListener("keydown", handleGesture, { passive: true });
    window.addEventListener(NARRATIVE_AUDIO_ACTIVATION_EVENT, current.sync);
    document.addEventListener("visibilitychange", current.sync);
    return () => {
      unsubscribe();
      window.removeEventListener("pointerdown", handleGesture);
      window.removeEventListener("keydown", handleGesture);
      window.removeEventListener(NARRATIVE_AUDIO_ACTIVATION_EVENT, current.sync);
      document.removeEventListener("visibilitychange", current.sync);
      gate.dispose();
      camera.remove(listener);
      if (runtimeRef.current === current) runtimeRef.current = null;
    };
  }, [camera]);

  useEffect(() => { runtimeRef.current?.sync(); }, [enabled]);

  useFrame((_, delta) => {
    const current = runtimeRef.current;
    if (!current) return;
    const film = getCurrentCinematicProfile();
    const audible = enabled && audioEnabled && !drawerOpen && !document.hidden && current.started;
    const qualityScale = qualityProfile.quality === "low" ? .56 : qualityProfile.quality === "medium" ? .78 : 1;
    const blend = 1 - Math.exp(-Math.max(0, Math.min(delta, .08)) * 1.8);
    for (const stem of current.stems) {
      const target = resolveNarrativeStemTarget(targetRef.current, stem.id, profile, presentation?.look ?? null, presentation?.stillness ?? 0, film);
      const volume = resolveAudioTargetVolume(target.volume * qualityScale * (reducedEffects ? .65 : 1), audioVolume, audible);
      stem.volume = audible ? THREE.MathUtils.lerp(stem.volume, volume, blend) : 0;
      // Avoid an inaudible exponential tail at completed Surrender or mute.
      if (volume === 0 && stem.volume < .00001) stem.volume = 0;
      const cutoff = Math.min(current.listener.context.sampleRate * .45, target.lowpassHz);
      stem.filter.frequency.value = THREE.MathUtils.lerp(stem.filter.frequency.value, cutoff, blend);
      stem.sound.setVolume(stem.volume * eventAmbientGain.current);
    }
  });

  return (
    <group name="NarrativeAudioDirector" userData={{ audioCue: profile.cue }}>
      {runtime?.stems.map(stem => (
        <primitive key={stem.id} object={stem.sound} name={`NarrativeAudioStem.${stem.id}`} />
      ))}
    </group>
  );
}

export default NarrativeAudioDirector;
