import { AudioContext as ThreeAudioContext, AudioListener } from "three";
import { journeyScenes } from "../src/data/journeyBlueprint.ts";
import { resolveSceneLook } from "../src/components/three/artDirection/SceneLookRegistry.ts";
import { advanceSceneMotion, type SceneMotionFrame } from "../src/components/three/artDirection/sceneMotion.ts";
import { NARRATIVE_AUDIO_STEM_IDS, resolveNarrativeAudioProfile, resolveNarrativeStemTarget, type NarrativeAudioStemId } from "../src/components/three/audio/narrativeAudioProfiles.ts";
import { createNarrativePlaybackGate, createNarrativeStemVoice, disposeNarrativeAudioNodes, getNarrativeStemBuffers, observeNarrativeAudioContext, pauseNarrativeAudioNodes, replaceNarrativeStemBuffer, type OwnedNarrativeStem } from "../src/components/three/audio/narrativeAudioRuntime.ts";
import { createProductionAudioLoader } from "../src/components/three/audio/productionAudioLoader.ts";
import { PRODUCTION_AUDIO_REGISTRY, reviewedProductionAudio } from "../src/components/three/audio/productionAudioRegistry.ts";

const select = (id: string) => document.getElementById(id) as HTMLSelectElement;
const input = (id: string) => document.getElementById(id) as HTMLInputElement;
const button = (id: string) => document.getElementById(id) as HTMLButtonElement;
const status = document.getElementById("status")!;
const report = document.getElementById("report")!;
for (const id of NARRATIVE_AUDIO_STEM_IDS) select("stem").add(new Option(id, id));
for (const scene of journeyScenes) select("scene").add(new Option(scene.id, scene.id));
select("scene").value = "broken-floor.confession";
const measurements: Record<string, unknown>[] = [];
const failures: string[] = [];
type Stem = OwnedNarrativeStem & { id: NarrativeAudioStemId; source: "procedural" | "reviewed" };
type Runtime = {
  context: AudioContext; listener: AudioListener; stems: Stem[]; bank: ReturnType<typeof getNarrativeStemBuffers>;
  gate: ReturnType<typeof createNarrativePlaybackGate>; loader: ReturnType<typeof createProductionAudioLoader>;
  unobserve: () => void; started: boolean; gestureStarted?: number; measurement?: Record<string, unknown>;
};
let runtime: Runtime | null = null, enabled = false, accepted = false, generation = 0;
const initialLook = resolveSceneLook("broken-floor.confession");
const frame: SceneMotionFrame = { motion: { ...initialLook.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 }, stillness: 0 };
const target = { volume: 0, lowpassHz: 0 };
const allowed = () => enabled && !document.hidden && Number(input("volume").value) > 0;
const snapshot = () => ({
  method: "Actual browser AudioContext + unchanged production PCM synthesis; high-quality fixture mix, no WebGL or story-event voices.",
  limitations: "CPU allocation/scheduling only, not speaker latency or listening/device certification. Production context lifetime remains owned by the app; this isolated fixture closes only its own contexts.",
  recordedAt: new Date().toISOString(), userAgent: navigator.userAgent,
  registry: PRODUCTION_AUDIO_REGISTRY, measurements, failures,
  current: { mode: select("mode").value, scene: select("scene").value, enabled, hidden: document.hidden,
    contextState: runtime?.context.state ?? "absent", stillness: frame.stillness,
    liveLoops: runtime?.stems.reduce((sum, stem) => sum + Number(stem.sound.isPlaying) + Number(stem.retiring?.sound.isPlaying ?? false), 0) ?? 0,
    stems: runtime?.stems.map(stem => ({ id: stem.id, source: stem.source, volume: stem.volume, cutoff: stem.filter.frequency.value,
      samples: stem.sound.buffer?.length, edgeDelta: stem.sound.buffer ? Math.abs(stem.sound.buffer.getChannelData(0)[0] - stem.sound.buffer.getChannelData(0)[stem.sound.buffer.length - 1]) : null })) ?? [],
  },
});
function show() { report.textContent = JSON.stringify(snapshot(), null, 2); }
function loaderFor(current: Runtime) {
  return createProductionAudioLoader({ context: current.context,
    active: () => runtime === current && current.started && allowed() && current.context.state === "running" && select("mode").value !== "fallback",
    ready: (id, buffer) => {
      const stem = current.stems.find(stem => stem.id === id)!;
      if (replaceNarrativeStemBuffer(current.listener, stem, buffer)) stem.source = "reviewed";
    },
  });
}
function resetLoader() {
  const current = runtime;
  if (!current) return;
  current.loader.dispose();
  for (const stem of current.stems) if (stem.source === "reviewed") {
    replaceNarrativeStemBuffer(current.listener, stem, current.bank.get(stem.id)!); stem.source = "procedural";
  }
  current.loader = loaderFor(current);
}
async function dispose() {
  enabled = false; generation++;
  const old = runtime; runtime = null;
  if (old) { old.unobserve(); old.gate.dispose(); await old.context.close(); }
  show();
}
button("enable").onclick = async event => {
  if (!event.isTrusted) return;
  try {
    await dispose();
    const version = ++generation;
    const started = performance.now();
    const requestedRate = Number(select("rate").value);
    const context = new AudioContext(requestedRate ? { sampleRate: requestedRate } : undefined);
    ThreeAudioContext.setContext(context);
    await context.resume();
    if (version !== generation) { await context.close(); return; }
    const resumed = performance.now();
    const listener = new AudioListener(); listener.getInput().gain.setValueAtTime(0, context.currentTime);
    const cold = performance.now(), bank = getNarrativeStemBuffers(context), allocated = performance.now();
    const sameBank = getNarrativeStemBuffers(context), cached = performance.now();
    const stems: Stem[] = NARRATIVE_AUDIO_STEM_IDS.map(id => ({ id, ...createNarrativeStemVoice(listener, bank.get(id)!), volume: 0, source: "procedural" }));
    const graph = performance.now();
    const current = { context, listener, stems, bank, started: false, unobserve: () => {} } as Runtime;
    current.loader = loaderFor(current);
    current.gate = createNarrativePlaybackGate({ allowed: () => runtime === current && allowed(), running: () => context.state === "running", resume: () => context.resume(),
      play: () => { for (const stem of stems) if (!stem.sound.isPlaying) stem.sound.play(); current.started = true; listener.setMasterVolume(1); },
      pause: () => { current.loader.pause(); pauseNarrativeAudioNodes(listener, stems); current.started = false; },
      dispose: () => { current.loader.dispose(); disposeNarrativeAudioNodes(listener, stems); },
    });
    current.unobserve = observeNarrativeAudioContext(context, () => current.gate.pause(), () => { void current.gate.start(); });
    runtime = current; enabled = true; await current.gate.start();
    const measurement: Record<string, unknown> = { kind: "cold-context-bank-and-first-schedule", requestedRate: requestedRate || "device-default", sampleRate: context.sampleRate,
      resumeMs: resumed - started, coldBankMs: allocated - cold, cacheLookupMs: cached - allocated, cacheIdentity: sameBank === bank,
      voiceGraphMs: graph - cached, firstGestureToSchedulingMs: performance.now() - started,
      bufferCount: bank.size, pcmBytes: [...bank.values()].reduce((sum, buffer) => sum + buffer.length * buffer.numberOfChannels * 4, 0),
      baseLatency: context.baseLatency, outputLatency: context.outputLatency ?? null,
    };
    current.measurement = measurement; current.gestureStarted = started; measurements.push(measurement);
    status.textContent = "Playing at the selected review volume. No asset has been promoted or written."; show();
  } catch (error) { failures.push(String(error)); status.textContent = String(error); await dispose(); }
};
button("pause").onclick = () => { enabled = false; runtime?.gate.pause(); status.textContent = "Paused; all ambient and retiring sources stopped."; show(); };
button("resume").onclick = async event => { if (!event.isTrusted) return; enabled = true; await runtime?.gate.start(); show(); };
button("dispose").onclick = () => { void dispose(); status.textContent = "Disposed; owned sources, filters, gains and context released."; };
select("mode").onchange = () => {
  button("seam").disabled = select("mode").value === "scene";
  resetLoader();
  status.textContent = select("mode").value === "reviewed" && !reviewedProductionAudio(PRODUCTION_AUDIO_REGISTRY[select("stem").value as NarrativeAudioStemId])
    ? "This stem has no reviewed recording. Its procedural fallback remains audible; no request is made." : "Mode changed using the production mix and replacement path.";
};
select("stem").onchange = () => { if (select("mode").value === "reviewed") select("mode").dispatchEvent(new Event("change")); };
select("scene").onchange = () => { accepted = false; };
button("surrender").onclick = () => { select("mode").value = "scene"; select("scene").value = "river.release-surrender"; accepted = true; button("seam").disabled = true; };
button("restore").onclick = () => { select("mode").value = "scene"; select("scene").value = "fork.weighing"; accepted = false; button("seam").disabled = true; };
button("seam").onclick = () => {
  const current = runtime;
  if (!current || select("mode").value === "scene" || !allowed()) return;
  current.gate.pause();
  for (const stem of current.stems) {
    stem.sound.stop();
    stem.sound.offset = stem.id === select("stem").value ? Math.max(0, (stem.sound.buffer?.duration ?? 0) - .15) : 0;
  }
  void current.gate.start(); status.textContent = "Playing across the selected loop's wrap, starting 150 ms before its end.";
};
input("volume").oninput = () => { if (!allowed()) runtime?.gate.pause(); else void runtime?.gate.start(); };
document.addEventListener("visibilitychange", () => { if (document.hidden) runtime?.gate.pause(); else void runtime?.gate.start(); show(); });
window.addEventListener("pagehide", () => { void dispose(); });
button("download").onclick = () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(snapshot(), null, 2)], { type: "application/json" }));
  const link = document.createElement("a"); link.href = url; link.download = "narrative-audio-audition.json"; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
let last = performance.now(), lastReport = 0;
function update(now: number) {
  const delta = Math.min(.08, (now - last) / 1000); last = now;
  const current = runtime;
  if (current) {
    const mixStarted = performance.now();
    const scene = journeyScenes.find(scene => scene.id === select("scene").value)!;
    const look = resolveSceneLook(scene.id, "high", false, { openingReveal: Number(input("reveal").value), compression: 1, surrenderComplete: accepted, mirrorStill: input("still").checked });
    const profile = resolveNarrativeAudioProfile({ chapterId: scene.chapterId, sceneId: scene.id, resonances: { wolf: 0, swan: 0, seer: 0 }, releasedWords: [], surrenderComplete: false });
    const audible = allowed() && current.started && current.context.state === "running";
    advanceSceneMotion(frame, look, delta, audible, false, false);
    const blend = 1 - Math.exp(-delta * 1.8);
    for (const stem of current.stems) {
      resolveNarrativeStemTarget(target, stem.id, profile, look, frame.stillness, look.emotional);
      const isolated = select("mode").value !== "scene";
      const volume = audible ? Number(input("volume").value) * (isolated ? stem.id === select("stem").value ? .2 : 0 : target.volume) : 0;
      if (volume > .00001 && select("mode").value !== "fallback") current.loader.request(stem.id);
      stem.volume = audible ? stem.volume + (volume - stem.volume) * blend : 0;
      if (volume === 0 && stem.volume < .00001) stem.volume = 0;
      stem.filter.frequency.value += (Math.min(current.context.sampleRate * .45, isolated ? 18000 : target.lowpassHz) - stem.filter.frequency.value) * blend;
      stem.sound.setVolume(stem.volume);
      if (stem.retiring) { stem.retiring.sound.setVolume(stem.volume); stem.retiring.filter.frequency.value = stem.filter.frequency.value; }
    }
    if (audible && current.gestureStarted !== undefined && current.measurement) {
      current.measurement.firstGestureToFirstMixMs = performance.now() - current.gestureStarted;
      current.measurement.initialSceneMixCpuMs = performance.now() - mixStarted;
      current.measurement.initialScene = scene.id;
      current.measurement.initialAudibleStemIds = current.stems.filter(stem => stem.volume > 0).map(stem => stem.id);
      current.gestureStarted = undefined;
    }
  }
  if (now - lastReport > 500) { show(); lastReport = now; }
  requestAnimationFrame(update);
}
requestAnimationFrame(update);
show();
