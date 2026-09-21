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
