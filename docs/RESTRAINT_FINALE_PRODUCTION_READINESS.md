# Restraint, Finale & Production Readiness

This handoff records the implementation and evidence available on 25 September 2026. The changes simplify physical storytelling and the Epilogue, retain existing narrative and interaction authority, and prepare explicit entry points for reviewed art and audio. Local results and the explicit WebKit runner limitation are recorded below. Publication, live identity and hosted CI status are recorded separately in the release verification artifact after the commit is pushed.

Evidence is saved outside Git in `../artifacts/restraint-finale-2026-09-25/`, relative to the repository root. The implementation preserves the existing prose, canonical story order, save schema, story/event IDs, journey geography, and SceneLook authority. No production recordings, hero models, or texture maps were supplied or invented.

## 1. Starting revision

The pass began from `2fe438ed0d3f29860ee225f1fe6269eaced0ef79` on `main` in `warrenstear30-afk/sitw`. A fresh dependency installation, typecheck, 534 unit tests, seven security tests, production build, full check, and six baseline browser tests passed before implementation.

## 2. Final revision

The release revision is the commit containing this report. The full final SHA, Cloudflare deployment ID, live identity checks and observed hosted CI status are recorded after publication in `../artifacts/restraint-finale-2026-09-25/release-verification.json` and the final handoff. This avoids embedding a self-referential commit hash in its own source.

## 3. Exact files changed

The intended source/documentation manifest at this handoff is:

| Status | Path |
| --- | --- |
| Deleted | `.github/workflows/materialize-final-4d-world.yml` |
| Modified | `README.md` |
| Modified | `docs/FINAL_4D_WORLD.md` |
| Added | `docs/RESTRAINT_FINALE_PRODUCTION_READINESS.md` |
| Modified | `e2e/cinematic-story-gameplay.spec.ts` |
| Modified | `e2e/opening-sequence.spec.ts` |
| Modified | `e2e/scene-polish.spec.ts` |
| Added | `public/art/heroes/README.md` |
| Added | `public/art/materials/README.md` |
| Added | `public/audio/README.md` |
| Modified | `scripts/review-cinematography.mjs` |
| Modified | `scripts/review-environment-presentation.mjs` |
| Modified | `scripts/review-scene-look-lifecycle.mjs` |
| Modified | `scripts/review-visual-presentation.mjs` |
| Modified | `scripts/review-woodland-presentation.mjs` |
| Modified | `src/components/three/artDirection/SceneLookRegistry.ts` |
| Deleted | `src/components/three/audio/EchoingClearingAudio.tsx` |
| Modified | `src/components/three/audio/NarrativeAudioDirector.tsx` |
| Modified | `src/components/three/audio/narrativeAudioRuntime.ts` |
| Added | `src/components/three/audio/productionAudioLoader.ts` |
| Added | `src/components/three/audio/productionAudioRegistry.ts` |
| Modified | `src/components/three/chapters/ForkChapter.tsx` |
| Modified | `src/components/three/chapters/IntegratedFinalTableau.tsx` |
| Modified | `src/components/three/chapters/NestChapter.tsx` |
| Modified | `src/components/three/chapters/domesticSpatialPressure.ts` |
| Modified | `src/components/three/reflections/ReflectedPath.tsx` |
| Modified | `src/components/three/storyEvents/StoryEventDirector.tsx` |
| Modified | `tests/build-version.test.mjs` |
| Modified | `tests/constellation-story.test.mjs` |
| Added | `tests/production-audio.test.mjs` |
| Modified | `tests/world-render-contracts.test.mjs` |

The build regenerates `src/data/worldState.json`; that generated difference was restored and is excluded from this source change. Captures, logs and the standalone gallery remain outside the app repository.

## 4. Nest simplifications

`NestChapter.tsx` replaces the mannequin-like supporting hands and emissive ring with two linen-draped timber supports. Their state-dependent balance preserves the shared-weight cue. Protection becomes four posts, overhead beams/rafters, and a supported linen canopy; the radial diagram, glowing sphere, and ground ring are removed.

`domesticSpatialPressure.ts` moves accumulated edge objects slightly further inward at maximum pressure and shares their layout with the throws, keeping the accumulation physically coherent. The child/rest centre, existing keys/candles, semantic targets, event conditions, and navigation authority remain intact. The shelter has open sides and introduces no colliders or new blockers. Matched desktop and mobile-sized captures record the supported construction, and the wider normal-motion quality matrix passed.

## 5. Epilogue simplifications

`IntegratedFinalTableau.tsx` removes the competing miniature home, giant moon, returned-self figure, Wolf/Swan/Seer cast, miniature chapter landmarks, and additional symbolic star formations. Crowned Return retains the physical homecoming and integration scene.

The Epilogue now consists of a dark clearing, restrained perimeter woodland, a small grounded Lantern continuity cue, the reverse-memory reveal, and the final history constellation. The Lantern cue uses the existing chosen placement identity without introducing a new light or floating halo. Actual placed-Lantern ownership and Crowned Return placement remain unchanged.

The existing 24-second reverse sequence, history order, repeated route segments, deduplicated stars, geography projection, formation easing, completion callback, and player-control handoff remain authoritative. Reverse-memory geometry unmounts when formation begins. The final sky contains only witnessed-history stars, their warmer keystone subset, and the connecting route. Each owned geometry has explicit disposal. Reduced motion retains immediate formation; normal motion retains gradual formation and capped frame deltas.

A centred presentation transform rotates the complete sky by −0.5 radians and applies a uniform 1.55 scale. It does not change the underlying memory coordinates or route proportions. A regression test traverses the actual rendered hierarchy, verifies equal scaling on all axes and preserved segment ratios, and projects its route inside desktop, portrait-mobile, and landscape-mobile viewports. Corrected final-source captures cover beginning, reverse, formation, and completion.

Canonical runtime review found no second Epilogue cast: active story actors are suppressed there, event-driven journeys bypass legacy WorldMemory visuals, and Epilogue habitat is disabled. The renderer lifecycle review also passed the actual reverse-geography, forming, and completed-constellation checks, including absence of competing tableau objects and once-only completion.

## 6. Blue Moon lighting decision

The selected `fillFloor` is **0.18** for `blue-moon.sanctuary` and `blue-moon.intimacy`, down from 0.28. Matched 0.18, 0.22, and 0.28 comparisons covered both scenes, desktop and mobile-sized views, and arrival/detail cameras. The selected value retained the Swan, linen, and bridge readability while reducing the broad fill. Other SceneLook families retain their previous values.

Evidence includes 20 dedicated comparison captures in `fill-018.json`, `fill-022.json`, `fill-detail-018.json`, `fill-detail-022.json`, and `fill-detail-028.json`, plus the 0.28 arrival views in the baseline. This is a lighting-only change: geometry, botanical density, reflections, particles, and shadow budgets were not increased. Matched arrival/detail captures and the extended quality matrix passed visual review; physical-screen brightness and first-time human discovery remain separate validation needs.

## 7. Seer text decision

`ReflectedPath.tsx` removes the generated “LOOK AGAIN” text texture and its plane. The reflected route, stillness-driven clarity, mirror/reflection authority, apparition, semantic target, and existing accessible guidance remain. Discovery is carried by the reflected environment rather than an instruction written into the scene. First-time discovery still needs human visual assessment; source preservation alone does not establish its clarity for every player.

## 8. Fork landmark

`ForkChapter.tsx` replaces the regular hemisphere and circular cap with one authored weathered sitting stone, grounded at the clearing floor. Its geometry is memoized and disposed by its owner. `StoryEventDirector.tsx` recognises the chapter-owned stone and suppresses the competing generic chair visual while retaining the existing `fork.weighing-stone` interaction pose and radius. Fork geography, routes, stillness requirements, and choices are unchanged.

## 9. Production audio registry

The new `productionAudioRegistry.ts` and `productionAudioLoader.ts` admit recordings only when explicitly marked `reviewed-production`, with local `/audio/` MP3/OGG alternatives, provenance/reviewer metadata, and valid loop/level settings. Unreviewed or absent files retain procedural fallback. `NarrativeAudioDirector` remains the scene, gesture, mute, visibility, and Surrender mixing authority; the unused parallel `EchoingClearingAudio` component is removed.

Recordings load lazily when a permitted running mix needs a stem. Limits include two concurrent jobs per AudioContext, 2 MiB compressed input, and two million decoded channel samples per asset. Independent loaders share per-context concurrency slots and the completed-loop cache. Duplicate requests coalesce within each loader; independent loaders do not coalesce their pending requests. Each codec attempt has a 15-second fetch/body deadline; abort cancels the body reader, while a non-abortable decode keeps its concurrency slot until settlement. Failed assets leave fallback playback available.

Loop preparation validates finite mono/stereo PCM, applies the reviewed trim and nominal level, and fades loop edges. Replacement uses a 350 ms crossfade under existing stem gain/filter control, with cleanup of retired sources. These checks prepare delivery; they do not substitute for listening to supplied recordings or verifying their loop seams on devices.

## 10. Remaining procedural audio

All ten shipping stem IDs remain `procedural-fallback` with no recording URL:

`room`, `wind`, `water`, `fire`, `glass`, `warmth`, `whisper`, `birds`, `cloth`, `wood`.

`public/audio/README.md` documents the handoff. No production audio files are included. Codec/device playback, artistic mix approval, and actual recording quality remain unverified until reviewed files exist.

## 11. Remaining production art

All 13 hero asset IDs remain authored fallbacks with no production URL:

`master-lantern`, `wolf`, `wolf-resting`, `swan`, `seer-reflection`, `cracked-mirror`, `moon-bridge`, `key`, `roses`, `lilies`, `writing-desk`, `reading-chair`, `fountain`.

The existing hero registry still requires `reviewed-production` and a local `/art/heroes/` GLB. The new handoff README describes bounds, placement, and review expectations. Legacy placeholder GLBs and concept PNGs have not been promoted into production assets.

All 11 material IDs likewise remain procedural, without reviewed texture channels:

`wet-wood`, `bark`, `plaster`, `linen`, `velvet`, `stone`, `earth`, `ash`, `metal`, `paper`, `wood`.

The existing material registry retains its reviewed-production gate, bounded dimensions/repeats, and local KTX2 channel contract. `public/art/materials/README.md` documents those requirements. These are production asset slots, not newly delivered models or maps.

## 12. Render-cost changes

The comparison now contains **42 valid matched before/after views**: 34 non-Epilogue views from `before.json`/`after.json`, and eight corrected ending views from `before-finale.json`/`after-finale.json`. The original eight `before-epilogue-*` views used an invalid fixture and are excluded. The replacement ending captures seed the actual keystone, full canonical history, placed Lantern, and controlled reverse clock; their phase assertions read the production formation group. The forming phase uses normal motion, and the completion capture waits for actual completion before its measurement window.

The following values are measured submitted draw calls and triangles, including reflection/shadow/finishing passes. Desktop is high quality at 1100 × 720; mobile-sized is low quality/reduced effects at 393 × 851. Both use DPR 1 and the recorded native Apple M1 Metal renderer. Each view receives 25 warm-up frames and 36 samples. These controlled scene fixtures are not a complete player walkthrough or sustained device-performance test.

| Scene / phase | Desktop calls | Mobile-sized calls | Desktop triangles | Mobile-sized triangles |
| --- | ---: | ---: | ---: | ---: |
| Nest: shared support | 60 → 49 | 54 → 43 | 32,585 → 30,265 | 19,384 → 17,064 |
| Nest: protection | 57 → 50 | 48 → 43 | 32,397 → 33,089 | 17,748 → 18,376 |
| Blue Moon: sanctuary | 100 → 100 | 36 → 36 | 97,733 → 97,733 | 27,066 → 27,066 |
| Blue Moon: intimacy | 144 → 144 | 62 → 62 | 109,737 → 109,737 | 31,864 → 31,864 |
| Seer: true mirror | 110 → 108 | 46 → 45 | 43,595 → 43,591 | 8,794 → 8,792 |
| Seer: stillness | 110 → 108 | 46 → 45 | 43,595 → 43,591 | 8,794 → 8,792 |
| Fork: weighing stone | 38 → 36 | 30 → 28 | 59,697 → 58,109 | 25,722 → 24,134 |
| Fork: four verbs | 59 → 58 | 40 → 39 | 63,305 → 63,149 | 27,046 → 26,890 |
| Fork: relinquish hope | 40 → 39 | 32 → 31 | 58,929 → 58,773 | 24,646 → 24,490 |
| Crowned Return | 97 → 97 | 68 → 68 | 36,787 → 36,787 | 24,194 → 24,194 |
| Epilogue: beginning | 117 → 11 | 80 → 7 | 31,200 → 10,145 | 20,179 → 6,808 |
| Epilogue: reverse | 143 → 37 | 106 → 33 | 36,480 → 15,425 | 25,151 → 11,780 |
| Epilogue: forming | 161 → 13 | 124 → 9 | 40,510 → 10,145 | 27,873 → 6,808 |
| Epilogue: complete | 161 → 13 | 124 → 9 | 40,510 → 10,145 | 27,873 → 6,808 |

Nest protection adds 692 desktop / 628 mobile-sized triangles for the supported shelter while reducing calls by seven / five; it is not a universal geometry reduction. Its geometry count falls 48 → 41 / 41 → 36. Shared support falls 51 → 40 / 47 → 36 geometries. Seer removes one texture in both configurations. Completed Epilogue geometries fall 156 → 12 / 119 → 9, textures 2 → 1 / 1 → 0, and lights 6 → 2 / 5 → 2. These are renderer resource counts, not measured byte savings.

Blue Moon topology and Crowned Return counts are unchanged. The other seven non-Epilogue scenes in this comparison also retain their recorded calls, triangles, geometries, textures, and lights. No FPS, sustained frame-pacing, thermal, or physical-mobile speedup is inferred from these short captures.

## 13. Mobile and reduced effects

Existing quality and reduced-effects inputs remain in charge of geometry/detail selection. Epilogue woodland stays bounded by quality; its simplified sky is shared across tiers. Reduced motion completes formation immediately while normal motion retains the timed formation. The strict Surrender zero-motion/time/particle assertions passed in both chapter fixtures and the canonical runtime.

The 42 matched views include desktop and mobile-sized/reduced configurations. A further **49-case normal-motion matrix across seven quality/viewport variants passed without capture failures**: low, medium, high and cinematic desktop; high with reduced effects; low portrait and low landscape with reduced effects. The renderer lifecycle review passed 26 cases with no errors; three recorded quality cycles held geometry/texture counts at 34/3. This bounded resource result does not prove all routes or long sessions leak-free. No physical-phone certification is claimed.

## 14. Tests

| Check | Confirmed result at handoff |
| --- | --- |
| Baseline dependency installation/typecheck | Passed |
| Baseline unit/security suites | 534 unit + 7 security passed |
| Baseline build/full check | Passed, including Pages Functions compilation |
| Baseline browser suite | 6 passed |
| Final source typecheck/unit/security | Passed; 554 unit + 7 security |
| Final source build/full check | Passed, including Pages Functions compilation |
| Physical browser tests | 4 passed in 20.0 seconds, desktop/mobile Chromium |
| Opening sequence / saved reveal / input handoff | 2 passed in 8.3 seconds, desktop/mobile Chromium |
| Audio lifecycle review | 12 checkpoints passed; no page/console errors or failures |
| Renderer lifecycle review | 26 cases passed; no errors; strict Surrender gates unchanged |
| Matched render captures | 34 ordinary + 8 corrected finale pairs complete; no capture failures |
| Extended normal-motion matrix | 49 captures passed across seven variants |
| Hero/silhouette review | 12 low/high lit/silhouette captures of Swan, Wolf and bridge passed |
| Repaired legacy visual review | 13 captures passed with native Metal; no failures |
| Repaired legacy environment review | 19 captures passed with native Metal; no failures |
| Post-CI-repair physical/opening regression | 6 desktop/mobile Chromium tests passed in 24.5 seconds with unchanged native bounds |
| Complete accessible journeys | 4 passed: first-scene and full canonical journey on desktop/mobile Chromium |
| Firefox accessibility smoke | 1 passed |
| WebKit / mobile WebKit accessibility smoke | 2 runner setup failures before navigation: unknown `PushAPIEnabled` setting |

The finale tests exercise actual component/frame logic with a stubbed host: real history geometry and repeated route segments, disposal, formation gates, capped time steps, reduced motion, once-only completion, and the actual sky hierarchy/projection. Source contracts assert the restrained scene and absence of removed text/objects. Audio tests cover registry admission, lazy loading, limits, cancellation, shared slots/cache, fallback, replacement lifecycle, and network deadlines.

Evidence includes `final-unit.log`, `final-typecheck.log`, `final-security.log`, `final-build.log`, `final-check.log`, `final-physical-browser.json`, `audio/review.json`, and `lifecycle/scene-look-lifecycle.json`. Existing bundle-size warnings remain; this pass does not replace the rendering architecture to hide them.

## 15. Browser validation

The six baseline passes covered desktop and mobile Chromium: opening physical wipe/reveal, reload retention and click handoff; accessible first-scene/prose behaviour without WebGL; and completion of canonical text scenes with Heart/Womb choices. The accessible completion test is not a claim of walking every 3D chapter. The final accessible suite also passed all four desktop/mobile Chromium cases, including both complete canonical journeys. Firefox passed the first-scene accessibility smoke.

The four final physical passes cover actual two-pointer-wipe/touch progression and jitter rejection/reload retention in desktop and mobile Chromium. Tests wait for actual rendered wipe stages and foreground the page before gestures/screenshots. Physical gestures, event assertions, and reload expectations remain; longer bounded observations accommodate software-rendered CI frames. The run had zero failures, skips, or flaky tests and completed in 20.0 seconds.

`review-scene-look-lifecycle.mjs` passed the running reverse phase and completed formation: actual entry IDs, projected memory positions, preserved repeated history, removal of reverse geometry, the two final star batches, no competing tableau, and exactly one completion. Its 26 cases also passed strict Surrender and SceneLook ownership/resource checks without errors.

The production UI audio review passed all 12 checkpoints: initial silence, trusted enable/start, pause, mute/unmount, cache reuse, zero volume, volume restoration, visibility handling, and text/canvas handoff. It instruments native Web Audio objects and trusted input. Visibility is exercised through a test-only document/event fixture, not native OS backgrounding. This is lifecycle evidence, not a listening test or heap/device-performance measurement.

Final-source matched captures, the corrected finale phases, all 49 extended matrix captures, and 12 low/high lit/silhouette views of Swan, Wolf and bridge passed. Original concept references were compared for mood, negative space and focal hierarchy; their PNGs remain documentation only. The authored fallback art does not claim photoreal production-model quality.

Both local WebKit projects failed while creating the page: `Protocol error (Page.overrideSetting): Unknown setting: PushAPIEnabled`. No application URL was visited; both traces contain zero network requests. The installed Playwright 1.62 driver sends that setting, while its manifest-selected macOS 14 ARM64 WebKit revision 2251 protocol lacks it. This is a local driver/browser incompatibility, not a claim that macOS 14 itself is unsupported. These are recorded as runner setup failures, and Safari remains unverified by this local run. No protocol setting, test or browser check was disabled to disguise the failure.

The standalone `index.html` gallery presents 42 matched pairs, three-level Blue Moon comparisons and additional lifecycle/matrix/hero evidence. Hosted publication and live smoke results are recorded in the release verification artifact.

## 16. CI and workflow findings

The obsolete privileged one-shot `materialize-final-4d-world.yml` workflow is removed. It could regenerate and commit content that is already checked in. The ordinary workflow remains responsible for checks/build/browser evidence without a generated-content commit. README and `FINAL_4D_WORLD.md` now describe audit/compile behaviour accurately; compiler implementation and story content are not changed by this cleanup.

The main workflow preserves install → non-browser check → fingerprint/upload → restore/verify the same build → all browser projects. The five useful specialised workflows remain. The baseline source/build/Pages job passed; its older physical smoke run failed on short readiness/screenshot/state-read bounds, which informed the targeted test corrections.

Hosted runs begin after publication. Their observed status is recorded by run URL and commit in `release-verification.json`; this source report makes no blanket hosted-CI pass claim. A successful deployment or local check does not establish that the complete hosted browser matrix passed.

The first hosted visual review of `f275599001d1d8f3aa08a72b91ab033f8899bcd5` failed before any capture: its historical baseline did not contain `StoryObjectModel.tsx` ([run 36126327880](https://github.com/warrenstear30-afk/sitw/actions/runs/36126327880)). The four legacy visual, environment, cinematography and woodland scripts now explicitly default to the verified starting main revision `2fe438ed0d3f29860ee225f1fe6269eaced0ef79` and check their required baseline paths before creating fixtures. `VISUAL_REVIEW_BASELINE` remains an explicit override with the same validation; there is no silent fallback. Capture assertions and rendering budgets are unchanged. The optional `REVIEW_ANGLE=metal` selects the local native backend; the default remains `swiftshader` for CI, unsupported values fail immediately, and each report records the requested backend. The repaired hosted review must complete before it can be reported as passing.

The repaired visual and environment scripts subsequently completed locally: 13 and 19 captures respectively, with empty failure lists and their temporary fixtures removed. All four scripts passed syntax checks and positive/negative baseline preflight checks, including missing commits, missing required files, and unsupported ANGLE values. These results are saved in `legacy-visual/review.json`, `legacy-environment/review.json`, and the migration-review logs. Native Metal results do not establish the outcome of the hosted SwiftShader run.

The first published smoke run also failed in software-rendered physical lanes ([run 36126327797](https://github.com/warrenstear30-afk/sitw/actions/runs/36126327797)). Its validation job, both semantic lanes, and mobile opening passed. Trace inspection showed the desktop opening preserved both wipes and restored state before a 57–58 second input operation exhausted the total 120-second budget; a physical retry passed inversion and completed its screenshot before the total 90-second deadline. Mobile scene-polish reached the correct restored state but a screenshot exhausted its own 30-second allowance. The three affected tests now use CI-only aggregate budgets of 240/300 seconds, with 60-second screenshot bounds in the physical/persistence tests. Local bounds, gestures, state assertions, readiness bounds, screenshot evidence, and error checks remain intact. These bounded changes address observed software-renderer timing; they do not claim acceptable hardware performance or a hosted pass before the replacement run completes. The post-repair full local check passed again, and all 85 production output fingerprints remained unchanged.

## 17. Build-version verification

The existing postbuild identity mechanism is retained: Cloudflare/GitHub/local Git revision precedence, strict SHA validation, branch, timestamp, repository URL, and dirty-state reporting. Tests now assert the migrated `warrenstear30-afk/sitw` URL, provider precedence, and version-cache contract.

The tested candidate's `dist/version.json` recorded the starting SHA, `main`, the migrated repository URL, and `dirty: true`, correctly identifying its then-uncommitted source. An 85-file SHA-256 manifest fingerprints that tested output, excluding only `version.json`. The first published revision, `f275599001d1d8f3aa08a72b91ab033f8899bcd5`, subsequently rebuilt with `dirty: false` and identical hashes for all 85 files; both production domains served that revision with `no-store`, and all 14 checked HTML/JavaScript/CSS/worker hashes matched. Two live desktop/mobile opening smoke tests passed. The final release also includes the four legacy-review baseline repairs and this report update; its revision and refreshed publication evidence are recorded in `release-verification.json`. Cloudflare was independently confirmed to track `warrenstear30-afk/sitw`, production branch `main`, with production deployments enabled.

## 18. Remaining real-device risks

Physical iOS/Android phones, Safari, thermal throttling, long-session memory, battery usage, outdoor/low-brightness readability, and real touch ergonomics are not certified by desktop Chromium or viewport emulation. Reviewed recordings will additionally need device codec, gesture/resume, loop-seam, and mix checks. Hero models and material maps need their own admission, visual, and resource review when supplied.

The remaining asset, Safari-runner and real-device limits above are not waived by local passing checks or publication.
