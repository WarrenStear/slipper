import { NARRATIVE_AUDIO_STEM_IDS, type NarrativeAudioStemId } from "./narrativeAudioProfiles.ts";
import type { Audio, AudioListener } from "three";

type OwnedStem = { sound: Audio; filter: BiquadFilterNode; volume: number };

export function pauseNarrativeAudioNodes(listener: AudioListener, stems: readonly OwnedStem[]) {
  const gain = listener.getInput().gain;
  gain.cancelScheduledValues(listener.context.currentTime);
  gain.setValueAtTime(0, listener.context.currentTime);
  for (const stem of stems) {
    if (stem.sound.isPlaying) stem.sound.pause();
    // Three.pause stops a source but does not detach its filter connection.
    stem.sound.disconnect();
    stem.sound.setVolume(0);
    stem.volume = 0;
  }
}

export function disposeNarrativeAudioNodes(listener: AudioListener, stems: readonly OwnedStem[]) {
  for (const stem of stems) {
    stem.filter.disconnect();
    stem.sound.getOutput().disconnect();
  }
  listener.getInput().disconnect();
  // The gesture context is shared and remains owned by narrativeAudioActivation.
}

// One bounded bank per existing gesture context, including StrictMode effect replay.
// A weak key lets a discarded context and all ten buffers be collected together.
const banks = new WeakMap<AudioContext, ReadonlyMap<NarrativeAudioStemId, AudioBuffer>>();
export function getNarrativeStemBuffers(context: AudioContext) {
  let bank = banks.get(context);
  if (!bank) {
    bank = new Map(NARRATIVE_AUDIO_STEM_IDS.map(id => [id, createStemBuffer(context, id)]));
    banks.set(context, bank);
  }
  return bank;
}

/** Cancel pending autoplay resumes on mute, visibility pause, or effect disposal. */
export function createNarrativePlaybackGate(actions: {
  allowed: () => boolean;
  running: () => boolean;
  resume: () => Promise<void>;
  play: () => void;
  pause: () => void;
  dispose: () => void;
}) {
  let disposed = false;
  let generation = 0;
  let pending: Promise<void> | null = null;
  return {
    start() {
      if (disposed || !actions.allowed()) return Promise.resolve();
      if (pending) return pending;
      const version = generation;
      const task = (async () => {
        try {
          if (!actions.running()) await actions.resume();
          if (!disposed && version === generation && actions.allowed() && actions.running()) actions.play();
        } catch {
          // A denied autoplay request can be retried by the next trusted gesture.
        }
      })();
      pending = task;
      void task.finally(() => { if (pending === task) pending = null; });
      return task;
    },
    pause() {
      if (disposed) return;
      generation += 1;
      pending = null;
      actions.pause();
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      generation += 1;
      pending = null;
      actions.pause();
      actions.dispose();
    },
  };
}

function seededNoise(seed: number) {
  let value = seed >>> 0;
  return () => {
    value = (1664525 * value + 1013904223) >>> 0;
    return value / 0xffffffff;
  };
}

export function createStemBuffer(context: AudioContext, stemId: NarrativeAudioStemId) {
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
  // A short raised-cosine edge avoids a discontinuity when this deterministic loop wraps.
  const edge = Math.min(Math.floor(sampleRate * .025), Math.floor(data.length / 2));
  for (let index = 0; index < edge; index += 1) {
    const gain = .5 - .5 * Math.cos(Math.PI * index / edge);
    data[index] *= gain;
    data[data.length - 1 - index] *= gain;
  }
  return buffer;
}
