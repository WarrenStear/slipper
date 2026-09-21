import assert from "node:assert/strict";
import test from "node:test";
import { JOURNEY_SCENE_IDS } from "../src/lib/storyJourneyState.ts";
import { EMOTIONAL_PROFILES, NEUTRAL_CINEMATIC_PROFILE, resolveCinematicProfile } from "../src/cinematics/emotionalProfiles.ts";
import { blendCinematicProfile, cinematicBlendAlpha, resolveCameraAttraction } from "../src/cinematics/emotionalCinematography.ts";
import { CINEMATIC_ACTOR_CUES, sampleActorCue, sampleFlockPose, flockInstanceCount } from "../src/cinematics/cinematicCueRegistry.ts";
import { canonicalSpatialExcerpt, canonicalQuestionExcerpts } from "../src/components/three/storyText/spatialProse.ts";
import { resolveEnvironmentalChoreography } from "../src/cinematics/environmentalChoreography.ts";
import { eventSilenceGain, materialSoundSamples, newAudibleStoryEvents, resolveStoryEventAudioCue } from "../src/components/three/audio/storyEventAudio.ts";
import { getAuthoredSceneArrival } from "../src/cinematics/sceneArrival.ts";

test("authored arrival keeps the river, branching paths and sovereign mirror ahead after scene rotation", () => {
  for (const sceneId of ["river.wash", "fork.weighing", "fork.four-verbs", "fork.relinquish-hope", "crowned.sovereignty"]) {
    const unrotated = getAuthoredSceneArrival(sceneId, [0, 0, 0], 0);
    const rotated = getAuthoredSceneArrival(sceneId, [100, 7, -40], Math.PI / 2);
    assert.ok(unrotated.focus[2] > unrotated.position[2], sceneId);
    assert.ok(rotated.focus[0] > rotated.position[0], sceneId);
    assert.ok(Math.abs(rotated.position[2] + 40) < 1e-8);
    assert.ok(Math.abs(rotated.focus[2] + 40) < 1e-8);
    assert.equal(rotated.position[1], 7);
  }
  assert.equal(getAuthoredSceneArrival("broken-floor.confession", [0, 0, 0], 0), null, "the tactile floor retains its own arrival");
});

test("all 32 canonical scenes have finite authored profiles within comfortable bounds", () => {
  assert.equal(JOURNEY_SCENE_IDS.length, 32);
  assert.deepEqual(Object.keys(EMOTIONAL_PROFILES), [...JOURNEY_SCENE_IDS]);
  for (const [id, profile] of Object.entries(EMOTIONAL_PROFILES)) {
    assert.ok(Object.values(profile).every(Number.isFinite), id);
    assert.ok(profile.fov >= 59 && profile.fov <= 72, `${id}: FOV`);
    assert.ok(profile.movementWeight >= 1 && profile.movementWeight <= 1.2, `${id}: movement remains playable`);
    assert.equal(profile.horizonStability, 1, `${id}: no horizon roll`);
    assert.ok(profile.gazeAttraction <= 0.018, `${id}: restrained attraction`);
  }
});

test("cinematic transitions blend every channel without overshoot and do not depend on refresh rate", () => {
  const from = { ...EMOTIONAL_PROFILES["fire.boundary"] };
  const target = EMOTIONAL_PROFILES["river.wash"];
  const at30 = { ...from }, at120 = { ...from };
  for (let i = 0; i < 30 * 4; i += 1) blendCinematicProfile(at30, target, 1 / 30);
  for (let i = 0; i < 120 * 4; i += 1) blendCinematicProfile(at120, target, 1 / 120);
  for (const key of Object.keys(target)) {
    assert.ok(Math.abs(at30[key] - at120[key]) < 1e-8, key);
    assert.ok(at30[key] >= Math.min(from[key], target[key]) - 1e-9 && at30[key] <= Math.max(from[key], target[key]) + 1e-9, key);
  }
  assert.equal(cinematicBlendAlpha(Number.NaN), 0);
  assert.equal(cinematicBlendAlpha(-1), 0);
  assert.ok(cinematicBlendAlpha(100) < 0.07, "a stalled tab cannot produce a camera jump");
});

test("warmth persists through depletion and compression; owned direction removes seduction", () => {
  const nest = resolveCinematicProfile("nest.two-hands");
  const exhaustion = resolveCinematicProfile("nest.unsupported-cycle");
  assert.ok(exhaustion.movementWeight > nest.movementWeight);
  assert.ok(Math.abs(exhaustion.warmth - nest.warmth) < 0.03);
  const houseOpen = resolveCinematicProfile("thorned.old-memory-bedroom", { compression: 0 });
  const houseClosed = resolveCinematicProfile("thorned.old-memory-bedroom", { compression: 1 });
  assert.ok(houseClosed.lowpassHz < houseOpen.lowpassHz);
  assert.ok(houseClosed.fov < houseOpen.fov);
  assert.equal(houseClosed.warmth, houseOpen.warmth);
  assert.ok(resolveCinematicProfile("blue-moon.intimacy").gazeAttraction > 0);
  assert.equal(resolveCinematicProfile("climb.heart").gazeAttraction, 0);
  assert.equal(resolveCinematicProfile("blue-moon.intimacy", { lanternOwned: true }).gazeAttraction, 0);
  assert.equal(resolveCinematicProfile("river.release-surrender", { surrenderComplete: true }).silenceBias, 1);
});

test("held input, recent input, accessibility and looking away override camera cues", () => {
  const base = { assistance: true, reducedMotion: false, inputActive: false, secondsSinceInput: 10, attraction: 0.018, facingDot: 0.9 };
  assert.equal(resolveCameraAttraction(base), 0.018);
  for (const override of [{ inputActive: true }, { secondsSinceInput: 1 }, { reducedMotion: true }, { assistance: false }, { facingDot: -1 }]) assert.equal(resolveCameraAttraction({ ...base, ...override }), 0);
});

test("authored cues are deterministic, wolves retreat without attacking, and lantern stops ahead", () => {
  const definition = CINEMATIC_ACTOR_CUES["enchanted.rabbit-hole"].find((cue) => cue.actor === "wolf");
  const pose = () => ({ x: 0, y: 0, z: 0, yaw: 0, visible: true });
  const player = [-6, 1.7, 4];
  const a = sampleActorCue(definition, 0, player, false, pose());
  const b = sampleActorCue(definition, 0, player, false, pose());
  assert.deepEqual(a, b);
  assert.ok(Math.hypot(a.x - player[0], a.z - player[2]) >= 3);
  for (const cues of Object.values(CINEMATIC_ACTOR_CUES)) for (const cue of cues) assert.notEqual(cue.cue, "attack");
  const lead = CINEMATIC_ACTOR_CUES["enchanted.rabbit-hole"].find((cue) => cue.actor === "lantern");
  assert.deepEqual(sampleActorCue(lead, 30, [0, 0, 0], false, pose()), sampleActorCue(lead, 60, [0, 0, 0], false, pose()));
  assert.equal(sampleActorCue(lead, 9.9, [0, 0, 0], false, pose()).visible, false);
  assert.equal(sampleActorCue(lead, 15, [0, 0, 0], false, pose()).visible, true);
});

test("flocks have bounded quality counts and staggered deterministic release; reduced motion only fades", () => {
  assert.deepEqual(["low", "medium", "high", "cinematic"].map((quality) => flockInstanceCount(quality, false)), [64, 128, 192, 256]);
  assert.equal(flockInstanceCount("cinematic", true), 24);
  assert.equal(flockInstanceCount("cinematic", false, true), 48);
  const pose = () => ({ x: 0, y: 0, z: 0, yaw: 0, flap: 0, scale: 0 });
  const tight = sampleFlockPose(12, 0, 0, false, false, pose());
  const released = sampleFlockPose(12, 0, 1, false, false, pose());
  assert.ok(released.y > tight.y + 8);
  assert.equal(released.scale, 0);
  assert.deepEqual(released, sampleFlockPose(12, 0, 1, false, false, pose()));
  const stillBefore = sampleFlockPose(12, 0, 0, false, true, pose());
  const stillAfter = sampleFlockPose(12, 99, 1, false, true, pose());
  for (const key of ["x", "y", "z", "yaw"]) assert.equal(stillBefore[key], stillAfter[key]);
  assert.equal(stillAfter.scale, 0);
});

test("spatial prose quotes contiguous source writing and never invents questions or ellipses", () => {
  const source = "What remains? The room remembers every footstep, every pause, and every word held beneath the water. " + "The same true memory remains. ".repeat(20);
  const entry = { body: source, paragraphs: [source] };
  const excerpt = canonicalSpatialExcerpt(entry);
  assert.ok(source.includes(excerpt));
  assert.ok(excerpt.length <= 230);
  assert.ok(!excerpt.includes("…"));
  assert.deepEqual(canonicalQuestionExcerpts(entry), ["What remains?"]);
  assert.deepEqual(canonicalQuestionExcerpts({ body: "The river continues.", paragraphs: [] }), []);
  assert.equal(NEUTRAL_CINEMATIC_PROFILE.gazeAttraction, 0);
});

test("environmental responses retain source consequences across scenes and restore without invented choices", () => {
  const empty = resolveEnvironmentalChoreography({});
  assert.equal(empty.candlesLit, false);
  assert.equal(empty.cagePhysical, false);
  assert.equal(empty.heartMemory, "");
  assert.equal(empty.creation, "");
  const state = {
    "blue-moon.candle": "lit", "blue-moon.cage-mirror": "reflected-cage",
    "nest.protected-linen": "carried", "nest.responsibility": "carried", "nest.day": "compressed",
    "thorn-house.table": "refilled-twice", "heart.memory": "swan-feather", "womb.creation": "voice",
  };
  const before = resolveEnvironmentalChoreography(state);
  assert.equal(before.handsOccupied, 2);
  assert.equal(before.daysCompressed, true);
  assert.equal(before.houseCompression, 1);
  assert.equal(before.cageReflected, true);
  assert.equal(before.cagePhysical, false);
  const after = resolveEnvironmentalChoreography({ ...state, "nest.responsibility": "placed", "river.soot": "washed", "river.white-fabric": "raised", "blue-moon.cage-mirror": "physical-cage" });
  assert.equal(after.handsOccupied, 1);
  assert.equal(after.daysCompressed, false);
  assert.equal(after.responsibilityResting, true);
  assert.equal(after.candlesLit, true);
  assert.equal(after.cagePhysical, true);
  assert.equal(after.sootWashed, true);
  assert.equal(after.surrendered, true);
  assert.equal(after.heartMemory, "swan-feather");
  assert.equal(after.creation, "voice");
  const burdened = resolveCinematicProfile("nest.unsupported-cycle", { nestHandsOccupied: 2 });
  const relieved = resolveCinematicProfile("nest.unsupported-cycle", { nestHandsOccupied: 1, nestBurdenResting: true });
  assert.ok(relieved.movementWeight < burdened.movementWeight);
  assert.equal(relieved.warmth, burdened.warmth);
  assert.ok(relieved.audioPressure < burdened.audioPressure);
});

test("physical event audio follows authored material cues and distinguishes preserved memory from burning", () => {
  assert.equal(resolveStoryEventAudioCue("broken-floor.first-wipe").material, "cloth");
  assert.equal(resolveStoryEventAudioCue("blue-moon.candle-chain").material, "candle");
  assert.equal(resolveStoryEventAudioCue("blue-moon.roses-placed").material, "petal");
  assert.equal(resolveStoryEventAudioCue("blue-moon.water-reveal").material, "water");
  assert.equal(resolveStoryEventAudioCue("fire.false-promise.flame").material, "fire");
  assert.equal(resolveStoryEventAudioCue("fire.true-memory.flame").material, undefined);
  assert.equal(resolveStoryEventAudioCue("fire.true-memory.flame").silenceFloor, 0);
  assert.equal(resolveStoryEventAudioCue("river.ash-washed").material, "water");
  assert.equal(resolveStoryEventAudioCue("nest.protection-recognised").material, "key");
  assert.equal(resolveStoryEventAudioCue("fork.declined").material, "wood");
  assert.equal(resolveStoryEventAudioCue("untrusted.unknown-event"), undefined);
});

test("saved history stays silent and event audio bursts are bounded", () => {
  const saved = ["broken-floor.first-wipe", "blue-moon.candle-chain"];
  assert.deepEqual(newAudibleStoryEvents(new Set(saved), saved), []);
  assert.deepEqual(newAudibleStoryEvents(new Set(saved), [...saved, "blue-moon.roses-placed"]), ["blue-moon.roses-placed"]);
  const burst = ["broken-floor.first-wipe", "blue-moon.candle-chain", "blue-moon.roses-placed", "river.ash-washed"];
  assert.equal(newAudibleStoryEvents(new Set(), burst).length, 3);
  assert.deepEqual(newAudibleStoryEvents(new Set(), [...burst, "nest.first-hand", "nest.second-hand", "fork.declined"]), []);
});

test("event silence reaches actual zero and releases smoothly; material synthesis is deterministic and restrained", () => {
  const silence = resolveStoryEventAudioCue("fire.true-memory.flame");
  assert.equal(eventSilenceGain(0, silence.silenceHold, silence.silenceFloor), 1);
  assert.equal(eventSilenceGain(0.2, silence.silenceHold, silence.silenceFloor), 0);
  assert.equal(eventSilenceGain(2, silence.silenceHold, silence.silenceFloor), 0);
  assert.ok(eventSilenceGain(3.5, silence.silenceHold, silence.silenceFloor) > 0);
  assert.equal(eventSilenceGain(6, silence.silenceHold, silence.silenceFloor), 1);
  for (const id of ["broken-floor.first-wipe", "blue-moon.candle-chain", "fire.false-promise.flame", "river.ash-washed", "nest.protection-recognised"]) {
    const cue = resolveStoryEventAudioCue(id);
    const samples = materialSoundSamples(cue, 8000);
    assert.equal(samples.length, Math.ceil(cue.duration * 8000));
    assert.deepEqual(samples, materialSoundSamples(cue, 8000));
    assert.ok(samples.some(value => value !== 0));
    assert.ok(samples.every(value => Number.isFinite(value) && Math.abs(value) <= 1));
    assert.ok(cue.duration <= 1.6 && cue.gain <= 0.042);
    assert.equal(Math.abs(samples[0]), 0, "envelope begins at zero without a click");
  }
});
