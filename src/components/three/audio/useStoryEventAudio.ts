import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { AudioListener } from "three";
import { subscribeAcceptedStoryEvents } from "../../../storyEvents/acceptedStoryEvents";
import { getGestureActivatedNarrativeAudioContext } from "../../../lib/narrativeAudioActivation";
import { MAX_CACHED_EVENT_BUFFERS, MAX_STORY_EVENT_VOICES, eventSilenceGain, materialSoundSamples, resolveStoryEventAudioCue } from "./storyEventAudio";
import { observeNarrativeAudioContext } from "./narrativeAudioRuntime";

type Voice = { source: AudioBufferSourceNode; filter: BiquadFilterNode; gain: GainNode; pan: StereoPannerNode; requestedGain: number; stop: () => void };
type Silence = { start: number; hold: number; floor: number };

/** Uses the existing trusted-gesture context. Never creates or resumes audio. */
export function useStoryEventAudio({ listener, enabled, audioVolume, reducedEffects, reducedMotion, sceneLookOwnsSurrender = false }: {
  listener: AudioListener | null; enabled: boolean; audioVolume: number; reducedEffects: boolean; reducedMotion: boolean;
  sceneLookOwnsSurrender?: boolean;
}) {
  const voices = useRef<Voice[]>([]);
  const buffers = useRef(new Map<string, AudioBuffer>());
  const silence = useRef<Silence | null>(null);
  const ambientGain = useRef(1);
  const config = useRef({ enabled, audioVolume, reducedEffects, reducedMotion, sceneLookOwnsSurrender });
  config.current = { enabled, audioVolume, reducedEffects, reducedMotion, sceneLookOwnsSurrender };

  useEffect(() => {
    if (enabled && audioVolume > 0) return;
    for (const voice of [...voices.current]) voice.stop();
    silence.current = null;
    ambientGain.current = 1;
  }, [enabled, audioVolume]);

  useEffect(() => {
    const pauseHidden = () => {
      if (!document.hidden) return;
      for (const voice of [...voices.current]) voice.stop();
      silence.current = null;
      ambientGain.current = 1;
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, []);

  useEffect(() => {
    if (!listener) return;
    return observeNarrativeAudioContext(listener.context, () => {
      for (const voice of [...voices.current]) voice.stop();
      silence.current = null;
      ambientGain.current = 1;
    }, () => {});
  }, [listener]);

  useEffect(() => subscribeAcceptedStoryEvents(({ eventIds }) => {
    // Hydration never publishes: a restored grief/recognition beat stays silent.
    const additions = eventIds.slice(-3);
    const context = getGestureActivatedNarrativeAudioContext();
    if (!config.current.enabled || document.hidden || !listener || !context || context !== listener.context || context.state !== "running") return;
    for (const eventId of additions) {
      // Shared SceneLook stillness owns the gradual Surrender and its return.
      // The legacy 140 ms event duck would otherwise cut across that same transition.
      if (eventId === "river.surrender" && config.current.sceneLookOwnsSurrender) continue;
      const cue = resolveStoryEventAudioCue(eventId);
      if (!cue) continue;
      if (cue.silenceFloor !== undefined) {
        silence.current = { start: context.currentTime, hold: cue.silenceHold ?? 1, floor: cue.silenceFloor };
        // A true memory quiets even an overlapping burn transient.
        if (cue.silenceFloor === 0) for (const voice of [...voices.current]) voice.stop();
      }
      if (!cue.material || cue.gain === 0 || config.current.audioVolume === 0) continue;
      while (voices.current.length >= MAX_STORY_EVENT_VOICES) voices.current[0].stop();
      const key = `${cue.material}:${cue.duration}:${cue.filterHz}:${cue.toneHz ?? 0}`;
      let buffer = buffers.current.get(key);
      if (!buffer) {
        const samples = materialSoundSamples(cue, context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.getChannelData(0).set(samples);
        if (buffers.current.size >= MAX_CACHED_EVENT_BUFFERS) buffers.current.delete(buffers.current.keys().next().value as string);
        buffers.current.set(key, buffer);
      }
      const source = context.createBufferSource();
      source.buffer = buffer;
      const filter = context.createBiquadFilter(); filter.type = "lowpass"; filter.frequency.value = cue.filterHz;
      const gain = context.createGain();
      gain.gain.value = cue.gain * config.current.audioVolume * (config.current.reducedEffects ? 0.6 : 1);
      const pan = context.createStereoPanner();
      pan.pan.value = config.current.reducedMotion || config.current.reducedEffects ? 0 : eventId.includes("rose") ? -0.12 : eventId.includes("candle") ? -0.2 : 0;
      source.connect(filter); filter.connect(gain); gain.connect(pan); pan.connect(listener.getInput());
      let stopped = false;
      const voice: Voice = { source, filter, gain, pan, requestedGain: cue.gain, stop: () => {
        if (stopped) return;
        stopped = true;
        source.onended = null;
        try { source.stop(); } catch { /* A naturally finished source is already stopped. */ }
        source.disconnect(); filter.disconnect(); gain.disconnect(); pan.disconnect();
        const index = voices.current.indexOf(voice); if (index >= 0) voices.current.splice(index, 1);
      } };
      voices.current.push(voice);
      source.onended = voice.stop;
      source.start();
    }
  }), [listener]);

  useFrame(() => {
    if (!listener) return;
    const event = silence.current;
    ambientGain.current = event ? eventSilenceGain(listener.context.currentTime - event.start, event.hold, event.floor) : 1;
    if (ambientGain.current >= 1 && event && listener.context.currentTime > event.start + 0.14) silence.current = null;
    for (const voice of voices.current) voice.gain.gain.value = config.current.enabled ? voice.requestedGain * config.current.audioVolume * (config.current.reducedEffects ? 0.6 : 1) : 0;
  });

  useEffect(() => () => {
    for (const voice of [...voices.current]) voice.stop();
    buffers.current.clear();
    silence.current = null;
    ambientGain.current = 1;
  }, [listener]);
  return ambientGain;
}
