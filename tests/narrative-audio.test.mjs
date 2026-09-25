import assert from "node:assert/strict";
import test from "node:test";
import {
  NARRATIVE_AUDIO_STEM_IDS,
  resolveNarrativeAudioProfile,
} from "../src/components/three/audio/narrativeAudioProfiles.ts";
import { journeyChapters, journeyScenes } from "../src/data/journeyBlueprint.ts";

const EMPTY_RESONANCES = { wolf: 0, swan: 0, seer: 0 };

test("every authored chapter resolves a restrained scene-specific audio profile", () => {
  for (const chapter of journeyChapters) {
    const scene = journeyScenes.find((candidate) => candidate.chapterId === chapter.id);
    assert.ok(scene, `${chapter.id} needs an authored scene`);
    const profile = resolveNarrativeAudioProfile({
      chapterId: chapter.id,
      sceneId: scene.id,
      resonances: EMPTY_RESONANCES,
      releasedWords: [],
      surrenderComplete: false,
    });

    assert.equal(profile.cue, scene.audioCue);
    assert.deepEqual(Object.keys(profile.stems), [...NARRATIVE_AUDIO_STEM_IDS]);
    assert.ok(Object.values(profile.stems).every((volume) => volume >= 0 && volume <= 0.4));
    assert.ok(Object.values(profile.stems).some((volume) => volume > 0));
  }
});

test("surrender deliberately reaches true silence", () => {
  const before = resolveNarrativeAudioProfile({
    chapterId: "fire-river",
    sceneId: "river.release-surrender",
    resonances: { wolf: 50, swan: 50, seer: 50 },
    releasedWords: ["hope"],
    surrenderComplete: false,
  });
  const after = resolveNarrativeAudioProfile({
    chapterId: "fire-river",
    sceneId: "river.release-surrender",
    resonances: { wolf: 50, swan: 50, seer: 50 },
    releasedWords: ["hope"],
    surrenderComplete: true,
  });

  assert.equal(after.stems.whisper, 0);
  assert.equal(after.master, 0, "completed surrender must reach true silence");
  assert.ok(after.master < before.master * 0.3);
});

test("the soundscape includes story-specific birds, cloth, and wood", () => {
  assert.ok(NARRATIVE_AUDIO_STEM_IDS.includes("birds"));
  assert.ok(NARRATIVE_AUDIO_STEM_IDS.includes("cloth"));
  assert.ok(NARRATIVE_AUDIO_STEM_IDS.includes("wood"));

  const nest = resolveNarrativeAudioProfile({
    chapterId: "nest",
    sceneId: "nest.two-hands",
    resonances: EMPTY_RESONANCES,
    releasedWords: [],
    surrenderComplete: false,
  });
  const house = resolveNarrativeAudioProfile({
    chapterId: "thorned-house",
    sceneId: "thorned.old-memory-bedroom",
    resonances: EMPTY_RESONANCES,
    releasedWords: [],
    surrenderComplete: false,
  });
  assert.ok(nest.stems.cloth > 0 && nest.stems.birds > 0);
  assert.ok(house.stems.wood > house.stems.cloth);
});

test("resonance alters motifs without exposing or replacing the chapter mix", () => {
  const quiet = resolveNarrativeAudioProfile({
    chapterId: "wolf-swan-seer",
    sceneId: "wolf-swan.convergence",
    resonances: EMPTY_RESONANCES,
    releasedWords: [],
    surrenderComplete: false,
  });
  const integrated = resolveNarrativeAudioProfile({
    chapterId: "wolf-swan-seer",
    sceneId: "wolf-swan.convergence",
    resonances: { wolf: 100, swan: 100, seer: 100 },
    releasedWords: [],
    surrenderComplete: false,
  });

  assert.ok(integrated.stems.fire > quiet.stems.fire);
  assert.ok(integrated.stems.water > quiet.stems.water);
  assert.ok(integrated.stems.glass > quiet.stems.glass);
});

const { resolveNarrativeStemTarget } = await import("../src/components/three/audio/narrativeAudioProfiles.ts");
const { resolveSceneLook } = await import("../src/components/three/artDirection/SceneLookRegistry.ts");
const { advanceSceneMotion } = await import("../src/components/three/artDirection/sceneMotion.ts");
const { createNarrativePlaybackGate, disposeNarrativeAudioNodes, getNarrativeStemBuffers, createStemBuffer, pauseNarrativeAudioNodes } = await import("../src/components/three/audio/narrativeAudioRuntime.ts");
const FILM = { audioPressure: 1, silenceBias: 0, lowpassHz: 18000 };
function profileFor(sceneId, resonances = EMPTY_RESONANCES) {
  const scene = journeyScenes.find(scene => scene.id === sceneId);
  return resolveNarrativeAudioProfile({ chapterId: scene.chapterId, sceneId, resonances, releasedWords: [], surrenderComplete: false });
}
function targetFor(id, look, stillness = 0, profile = profileFor(look.sceneId)) {
  return resolveNarrativeStemTarget({ volume: 0, lowpassHz: 0 }, id, profile, look, stillness, FILM);
}

test("the mundane opening reveals forest air through the same SceneLook state", () => {
  const raw = resolveSceneLook("broken-floor.confession");
  const clearing = resolveSceneLook("broken-floor.confession", "high", false, { openingReveal: .5 });
  const revealed = resolveSceneLook("broken-floor.confession", "high", false, { openingReveal: 1, openingInverted: true });
  const resonant = profileFor(raw.sceneId, { wolf: 100, swan: 100, seer: 100 });
  for (const id of ["glass", "warmth", "whisper", "fire", "wind", "birds"]) {
    assert.equal(targetFor(id, raw, 0, resonant).volume, 0, `${id} must not score the mundane opening`);
  }
  assert.ok(targetFor("room", raw).volume > targetFor("room", clearing).volume);
  assert.ok(targetFor("room", clearing).volume > targetFor("room", revealed).volume);
  assert.ok(targetFor("wind", revealed).volume > targetFor("wind", clearing).volume);
  assert.ok(targetFor("birds", revealed).volume > 0);
  assert.ok(targetFor("water", raw).lowpassHz < targetFor("water", revealed).lowpassHz);
});

test("woodland, broad water, and confined domestic acoustics are distinct without extra stems", () => {
  const wood = resolveSceneLook("enchanted.friendship-meadow");
  const blue = resolveSceneLook("blue-moon.sanctuary");
  const home = resolveSceneLook("thorned.old-memory-bedroom", "high", false, { compression: 1 });
  const released = resolveSceneLook("thorned.self-owned-world", "high", false, { compression: 1 });
  assert.ok(targetFor("wind", wood).volume > targetFor("water", wood).volume * 5);
  assert.ok(targetFor("water", blue).volume > targetFor("wind", blue).volume * 5);
  assert.ok(targetFor("water", blue).lowpassHz < targetFor("water", wood).lowpassHz);
  assert.ok(targetFor("room", home).volume > targetFor("wind", home).volume * 10);
  assert.ok(targetFor("wood", home).lowpassHz < targetFor("wood", released).lowpassHz);
  assert.ok(targetFor("wind", released).volume > targetFor("wind", home).volume);
  assert.equal(NARRATIVE_AUDIO_STEM_IDS.length, 10);
});

test("Seer shared stillness lowers pressure and frequency detail without muting the water entirely", () => {
  const look = resolveSceneLook("sunset.stillness", "high", false, { mirrorStill: true });
  for (const id of ["wind", "water", "glass"]) {
    const before = targetFor(id, look, 0);
    const halfway = targetFor(id, look, .5);
    const still = targetFor(id, look, 1);
    assert.ok(before.volume > halfway.volume && halfway.volume > still.volume && still.volume > 0);
    assert.ok(before.lowpassHz > still.lowpassHz);
  }
});

test("Surrender collapses gradually to exact silence on the shared clock, including reduced motion", () => {
  const look = resolveSceneLook("river.release-surrender", "high", false, { surrenderComplete: true });
  for (const reduced of [false, true]) {
    const frame = { motion: { ...look.motion }, time: { vegetation: 0, cloth: 0, water: 0, particles: 0, flame: 0 }, stillness: 0 };
    const opening = targetFor("water", look, frame.stillness).volume;
    let last = opening;
    advanceSceneMotion(frame, look, .05, false, reduced, reduced);
    assert.equal(frame.stillness, 0, "paused presentation cannot advance the acoustic clock");
    for (let i = 0; i < 160; i++) {
      advanceSceneMotion(frame, look, .05, true, reduced, reduced);
      const volume = targetFor("water", look, frame.stillness).volume;
      assert.ok(volume <= last);
      if (i === 0) assert.ok(volume > opening * .5, "accepted surrender cannot cut the world off immediately");
      last = volume;
    }
    assert.equal(frame.stillness, 1);
    for (const id of NARRATIVE_AUDIO_STEM_IDS) assert.equal(targetFor(id, look, frame.stillness).volume, 0);
  }
  const beforeWater = targetFor("water", look).volume;
  const beforeBirds = targetFor("birds", look).volume;
  assert.ok(targetFor("water", look, .5).volume / beforeWater > targetFor("birds", look, .5).volume / beforeBirds);
});

test("after stillness, sparse outside air returns before the other layers", () => {
  const look = resolveSceneLook("fork.weighing");
  const wind = targetFor("wind", look, .8).volume / targetFor("wind", look, 0).volume;
  const wood = targetFor("wood", look, .8).volume / targetFor("wood", look, 0).volume;
  assert.ok(wind > wood * 5);
  for (const id of NARRATIVE_AUDIO_STEM_IDS) assert.equal(targetFor(id, look, 1).volume, 0);
  assert.ok(targetFor("wind", look, 0).volume > 0);
});

test("all acoustic targets remain finite and restrained at each authored scene and quality", () => {
  const out = { volume: 0, lowpassHz: 0 };
  for (const scene of journeyScenes) for (const quality of ["low", "medium", "high", "cinematic"]) {
    const look = resolveSceneLook(scene.id, quality, true, { mirrorStill: true, surrenderComplete: true, compression: 1, openingReveal: 1 });
    for (const id of NARRATIVE_AUDIO_STEM_IDS) {
      assert.equal(resolveNarrativeStemTarget(out, id, profileFor(scene.id), look, .5, look.emotional), out);
      assert.ok(Number.isFinite(out.volume) && out.volume >= 0 && out.volume <= .5);
      assert.ok(Number.isFinite(out.lowpassHz) && out.lowpassHz >= 80 && out.lowpassHz <= 18000);
    }
  }
});

function audioContextStub(sampleRate = 4000) {
  return { sampleRate, allocations: 0, createBuffer(channels, length, rate) {
    this.allocations++;
    const samples = new Float32Array(length);
    return { length, numberOfChannels: channels, sampleRate: rate, getChannelData: () => samples };
  } };
}
test("ambient bank reuses exactly ten deterministic bounded buffers with click-free loop endpoints", () => {
  const context = audioContextStub();
  const bank = getNarrativeStemBuffers(context);
  assert.equal(getNarrativeStemBuffers(context), bank, "mute/remount/StrictMode must not rebuild the bank");
  assert.equal(context.allocations, 10);
  assert.equal(bank.size, 10);
  let samples = 0;
  for (const id of NARRATIVE_AUDIO_STEM_IDS) {
    const buffer = bank.get(id);
    const data = buffer.getChannelData(0);
    assert.equal(buffer.numberOfChannels, 1);
    assert.ok(data[0] === 0);
    assert.ok(data.at(-1) === 0);
    assert.ok(data.every(value => Number.isFinite(value) && Math.abs(value) < .5));
    assert.ok(data.some(value => value !== 0));
    assert.deepEqual(data, createStemBuffer(audioContextStub(), id).getChannelData(0));
    samples += data.length;
  }
  assert.equal(samples / context.sampleRate, 47.6, "preserve the existing total mono duration");
  const second = audioContextStub(8000);
  assert.notEqual(getNarrativeStemBuffers(second), bank);
  assert.equal(second.allocations, 10);
});

function playbackHarness() {
  let allowed = true, running = false;
  let release;
  const stats = { starts: 0, pauses: 0, disposals: 0, resumes: 0 };
  const gate = createNarrativePlaybackGate({
    allowed: () => allowed, running: () => running,
    resume: () => { stats.resumes++; return new Promise(resolve => { release = () => { running = true; resolve(); }; }); },
    play: () => stats.starts++, pause: () => stats.pauses++, dispose: () => stats.disposals++,
  });
  return { gate, stats, release: () => release(), allow: value => { allowed = value; } };
}
test("a resume resolved after visibility/mute pause cannot restart audio", async () => {
  const { gate, stats, release, allow } = playbackHarness();
  const first = gate.start();
  assert.equal(gate.start(), first, "coalesce repeated gesture requests");
  gate.pause(); allow(false); release(); await first;
  assert.equal(stats.starts, 0);
  assert.equal(stats.resumes, 1);
  assert.equal(stats.pauses, 1, "pause is synchronous and does not depend on a frame");
  await gate.start(); assert.equal(stats.starts, 0);
  allow(true); await gate.start(); assert.equal(stats.starts, 1);
});
test("unmount cancels pending resumes and disposes owned nodes exactly once", async () => {
  const { gate, stats, release } = playbackHarness();
  const pending = gate.start();
  gate.dispose(); gate.dispose(); release(); await pending; await gate.start();
  assert.deepEqual(stats, { starts: 0, pauses: 1, disposals: 1, resumes: 1 });
});
test("a paused stale resume cannot race a new valid gesture into duplicate playback", async () => {
  let running = false;
  const resumes = [];
  let starts = 0;
  const gate = createNarrativePlaybackGate({ allowed: () => true, running: () => running,
    resume: () => new Promise(resolve => resumes.push(() => { running = true; resolve(); })),
    play: () => starts++, pause() {}, dispose() {},
  });
  const stale = gate.start(); gate.pause(); const valid = gate.start();
  resumes[0](); await stale; assert.equal(starts, 0);
  resumes[1](); await valid; assert.equal(starts, 1);
  gate.dispose();
});

test("mute cancels listener automation, stops and detaches every stem; disposal releases only owned nodes", () => {
  const calls = [];
  const input = { gain: {
    cancelScheduledValues: time => calls.push(["cancel", time]),
    setValueAtTime: (value, time) => calls.push(["master", value, time]),
  }, disconnect: () => calls.push(["listener-disconnect"]) };
  const listener = { context: { currentTime: 12, close: () => assert.fail("shared context must survive unmount") }, getInput: () => input };
  const stems = NARRATIVE_AUDIO_STEM_IDS.map(id => ({ volume: .2,
    sound: { isPlaying: true,
      pause() { this.isPlaying = false; calls.push(["pause", id]); },
      disconnect: () => calls.push(["source-disconnect", id]),
      setVolume: volume => calls.push(["stem-volume", id, volume]),
      getOutput: () => ({ disconnect: () => calls.push(["gain-disconnect", id]) }),
    }, filter: { disconnect: () => calls.push(["filter-disconnect", id]) },
  }));
  pauseNarrativeAudioNodes(listener, stems);
  assert.deepEqual(calls.slice(0, 2), [["cancel", 12], ["master", 0, 12]]);
  assert.ok(stems.every(stem => stem.volume === 0 && !stem.sound.isPlaying));
  assert.equal(calls.filter(([kind]) => kind === "pause").length, 10);
  assert.equal(calls.filter(([kind]) => kind === "source-disconnect").length, 10);
  disposeNarrativeAudioNodes(listener, stems);
  assert.equal(calls.filter(([kind]) => kind === "filter-disconnect").length, 10);
  assert.equal(calls.filter(([kind]) => kind === "gain-disconnect").length, 10);
  assert.equal(calls.filter(([kind]) => kind === "listener-disconnect").length, 1);
});
