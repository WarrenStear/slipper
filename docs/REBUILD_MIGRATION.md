# Slipper in the Woods: controlled rebuild

## Source and method

The implementation target is `WarrenStear/slipper`, branch `main`. The audited
starting revision is `8567a2fa41f05aa4624873b4732f569e5b56505a` (5 October 2026).
The October biome, ecology, terrain, river, asset-delivery and WebGL changes are
part of this baseline. Historical repositories are not implementation sources.

This migration changes ownership incrementally. Each phase is validated before
its commit. Canonical content and persisted identifiers remain authoritative;
presentation consumes them instead of creating a second story model. The first
experience milestone is the opening through the first Fragment and Constellation.

## Baseline architecture: evidence from the application before migration

| Concern | Current authority | Overlap or constraint |
| --- | --- | --- |
| Persisted narrative | `useJourneyStore`, `storyJourneyState`, `journeyNarrative`, `journeyBlueprint` | The store is canonical. `JourneyDirector` and `AccessibleStoryJourney` duplicate ritual outcome dispatch. |
| Content | `slipperArchiveSource`, `slipperContent`, `journeyNarrative` | 66 entries, 12 chapters, 32 scenes, 99 compatibility beats, 9 ritual IDs, 132 story events and 61 story objects. |
| Rendering boundary | `WorldCanvas`, `RenderRecoveryBoundary` | Canvas, quality, physics, lazy loading and text recovery must survive extraction. |
| Player input | `usePlayerInputStore`, `useMobileViewport`, keyboard hook inside `StoryScene` | The transient input store is separate from saves; focus/visibility interruptions already clear input. |
| Movement | `StoryScene.FirstPersonPlayer` and Rapier character controller | Physical movement reads chapter, memory and cinematic interpretation; those dependencies should become numeric parameters. |
| Camera | `FirstPersonPlayer`, `AnimatedSceneCamera`, pointer/orbit controls, `CinematicCameraDirector` | Several imperative writers. Body-follow can overwrite arrival positioning before the camera is ready. Preserve comfortable look and interruption guards while establishing ordering. |
| World/terrain | `StoryScene` path builders, terrain sampler/cache, ground and forest; `OutdoorLandscape` | Keep exact seeded path generation and canonical worker parity. New landscape uses the same terrain buffers for visuals and colliders. |
| Guidance | `navigationResolver`, `NodeProximityActivator`, App target routing | Nearest physical observations and narrative route ranking are mixed. App already validates physical entry observations before accepting navigation. |
| Interactions | `StoryEventDirector`, story attention runtime, `JourneyDirector` | Range/gaze detection is mixed with event eligibility and consequences. Attention uses elapsed time and pause guards, not frame counts. |
| Global presentation | `SceneLookDirector`, `SCENE_LOOKS`, shared scene-look state | This is already the mounted canonical global light/fog/sky/finishing authority for narrative scenes. Preserve it. |
| Compatibility presentation | `WorldVisualState`, chapter director, gated legacy `StoryScene` atmosphere/lights | Fallback rendering is intentionally gated on absence of a canonical narrative scene. Standalone review fixtures still use adapters. |
| Local presentation | `JourneySceneDirector`, chapter components, actors, `EnvironmentalChoreography` | These mount authored scene imagery and motivated practical lights; they must not become independent global rigs. |
| Memory aftermath | `WorldMemoryDirector`, `storyAftermath`, `journeyMemoryProjection` | Persistent landmark presentation is specialised; it is not a second story authority. |
| Lantern | `deriveLanternNarrative`, wrapper, `MasterLantern` | One canonical carried lantern. Opening acceptance is a compatibility ritual; later inventory ownership and placement have distinct semantics. |
| Audio | `NarrativeAudioDirector`, procedural bed, stem registry, gesture activation | Existing scene-driven stem mixing, visibility pause, volume/reduced-effects gates and crossfade remain. No reviewed recordings are fabricated. |
| UI/bootstrap | `App`, global settings drawer, accessible journey, Archive/Constellation/reader | App owns routing, restore, progression interpretation and large presentation blocks. These concerns can be extracted without changing routes. |
| Cloud persistence | `useCloudJourneySync`, transport/storage helpers, Pages Functions | Restore-before-write, timestamp/provenance, account invalidation and malformed-save 409 recovery are production boundaries. |

### Director classification

* **Canonical authorities:** persisted journey store, `SceneLookDirector` for
  global presentation, `NarrativeAudioDirector` for audio. `JourneyDirector` is
  the existing progression action adapter and will consume the narrative domain.
* **Specialised subsystems:** story-event/attention orchestration, persistent
  world-memory presentation, transition input/prose gate, environmental aftermath.
* **Presentation helpers:** journey scene composition and story actors.
* **Compatibility adapters:** world visual/chapter palette and budget derivation,
  legacy chapter-light gate and standalone review camera adapter.
* **Redundant/unmounted alternatives:** `WorldLightingRig`, `WorldAtmosphere`,
  emotional cinematic lighting/atmosphere rigs. Remove only after reference
  checks and equivalent ownership contracts pass.

## Main architecture problems

* `StoryScene.tsx` has 7,203 lines and 26 `useFrame` subscriptions at baseline.
  It includes keyboard input, Rapier movement, camera, terrain/path generation,
  forest instancing, atmosphere, lighting, landmarks and physical proximity.
* `App.tsx` has 1,635 lines. Mini-map styling/drawing, navigation prompt,
  Fragment and map presentation coexist with restore/recovery/bootstrap logic.
* Global CSS is split across `styles.css` (2,131 lines),
  `experiencePolish.css` (502) and `mobileEnhancements.css` (381), plus local
  styles. Extraction must preserve precedence before introducing scoped rules.
* `JourneyDirector.applyJourneyOutcome` and accessible `applyRitualOutcome`
  repeat the same mutation dispatch. Presentation surfaces reconstruct access,
  current scene, completion and opening release separately.
* Physical player movement queries story/chapter/cinematic rules directly.
  Arrival, body-follow, look and cinematic assistance share camera mutation.
* `NodeProximityActivator` combines sampled physical facts, spatial culling,
  navigation ranking, hysteresis and UI publication.
* Production guards pin implementations to filenames and source strings:
  `check-final-4d-world`, mobile validator, render-contract tests, opening and
  cinematography review fixtures. Move those checks to actual domain owners;
  retain each invariant and add executable pure-function/behavioral coverage.
* Historical `repair:world:legacy` scripts patch monolithic source. They are not
  part of production prebuild and must not be run against migrated boundaries.

## Target architecture being implemented

* `narrative/`: pure interpretation/selectors and a typed action/runtime adapter
  around the existing store. No duplicate Zustand store or copied outcomes.
* `player/`: numeric movement model, Rapier/input controller, one ordered camera
  authority, and factual interaction detection. No progression mutations.
* `world/terrain`, `world/forest`, `world/guidance`, `world/atmosphere`,
  `world/lighting`: real implementations extracted from existing owners with
  stable compatibility exports where the application/review fixtures need them.
* `experience/`: bootstrap/routing and focused composition. `ui/` owns real
  Fragment, contextual navigation and Constellation surfaces.
* `scenes/`: declarative presentation derived from canonical scene metadata,
  then scene-specific authored composition. A manifest references IDs and
  presentation profiles; it never restates progression outcomes.
* `audio/`: existing audio authority with reviewed authored-stem slots and safe
  procedural fallback. Photographic slots accept existing content mappings only.

Each domain is created only when actual implementation or a used pure contract
is moved into it. No new director, global event bus or parallel persisted story
state is required.

## Compatibility strategy

* Preserve the canonical archive/prose, paragraph boundaries and narrative order.
  Do not change `slipperArchiveSource`, authored progression outcomes or IDs to
  make a refactor easier.
* Preserve `sidtw:journey:v3`, store persistence version 6, story snapshot schema
  2 and cloud schema 2. Existing sanitizers, provenance, bookmarks, inventory,
  world flags, ritual/event/object IDs and saved safe player pose remain valid.
* Keep `useJourneyStore` as the sole persisted narrative authority. Text and 3D
  use the same selectors and outcome dispatch; rendering does not grant progress.
* Retain public component/type exports during staged extraction. Update source
  guards to the real owner, and keep compatibility adapters until all production
  and review callers migrate.
* Preserve deterministic terrain sampling, seeded authored routes, worker
  generation/revision checks, instancing, collider budgets and quality prefixes.
  The newer biome/ecology modules and asset registries remain in use.
* Preserve keyboard/mobile input cancellation, pointer ownership, low opening
  camera and grounded collisions. Physical detection reports observations;
  narrative action validation accepts or rejects them.
* Preserve accessible/text entry, unread-prose privacy, focus traps, return to
  Forest, bookmarks, map/archive keyboard controls and render/chunk recovery.
* Preserve reduced motion/effects, quality tiers, visibility audio suspension,
  gesture activation, volume and generated fallback behavior.
* Keep Pages Functions contracts, local decoder delivery, manifests, production
  build revision tracking and current Cloudflare compile/deploy expectations.
  CI validates source and renders; CI does not deploy.

## Validation and phase ledger

Baseline readiness before this migration: integration validation, lint and 926
unit tests passed. The production push at the audited SHA passed the full
validation workflow (`37348602445`): source/unit/security/build/Pages Functions,
local Draco/Basis delivery and all five browser projects. Baseline
line counts are evidence, not a new line-count acceptance test.

The separate Story interaction smoke workflow passed. The baseline Visual
presentation review (`37348602370`) failed its House aftermath low-quality
added draw-call budget (4 calls). The repair batches each linen rail into
existing window timber, retaining geometry/transforms/colors and fabric draws.
The exact 19-capture review now has zero failures: the side view adds 3 calls,
7,284 triangles and no lights, within the unchanged limit. Typecheck and 28
focused geometry/chapter/environment tests passed. The first failed CI log and
completed desktop/mobile evidence are retained outside source under
`artifacts/rebuild-20261005/baseline-budget-repair`. Repair commit `2280cf4`
passed both remote full regression (`37351828593`, all five browser projects)
and Visual presentation review (`37351828560`).

| Phase | Implementation | Validation / status |
| --- | --- | --- |
| 1. Foundation | This document first; shared narrative selectors/actions/runtime; used compatibility boundaries. | Complete (`1ae2b98`): full check and 16 desktop/mobile text/cloud browser tests passed. |
| 2. Player | Input, movement, camera, factual interaction detection; one ordered camera writer. | Complete (`770a9ab`): full check, seven applicable mobile tests and three desktop opening/keyboard tests passed. |
| 3. World | Exact terrain/forest/guidance/atmosphere extraction; preserve ecology and seeded paths. | Complete (`c00777d`): full check, 14 fixed-camera captures and five touch browser tests passed; Linux numeric fixture portability repair follows. |
| 4. Presentation | Canonical light, fog, sky and particles; early compatibility gates and shared presentation activity. | Complete (`9b0b62a`), followed by retained-loading recovery repair (`ae8fd04`); measured appearance/lifecycle proof below. |
| 5. Manifest / runtime | Derived presentation/spawn/profiles/interaction references; one transient runtime and explicit physical/text commands. | Complete: 1,133 unit / seven security tests and awake built desktop/mobile acceptance passed; commit prepared. |
| 6. Opening slice | Arrival, floor/reflection, reveal, lantern, first walk, Fragment, Constellation. | Pending structural phases; desktop/mobile real-input proof required. |
| 7. Quiet Forest | Environment/lantern guidance and contextual prompts; accessible assistance retained. | Pending guidance usability proof. |
| 8. Chapters | One defining image per chapter, migrate incrementally, preserve outcomes/fallbacks. | Pending opening proof. |
| 9. Reading / memory map | Calm first-class reader; witnessed-only constellation connections/content. | Pending. |
| 10. Audio / photographs | Authored slots and exact existing photographic mappings; fallback remains. | Pending. |
| 11. Legacy | Remove only unused implementations/scripts after equivalent guards pass. | Pending. |

For each phase record its commit, exact commands/results, behavior exercised and
any outstanding limits here. Relevant checks include typecheck, unit/security,
content QA, production build, asset/world validation, Pages Functions compilation
and unchanged/extended Playwright desktop/mobile flows. Browser results require
actual execution; a source/build pass alone is not render validation. Failed
checks remain visible and are fixed before the phase commit.

### Phase 1: narrative and experience boundaries

`narrative/StorySelectors` now owns navigation compatibility, witnessed-only
prose access, current canonical location, opening release and legacy act
eligibility. `StoryRuntime` derives progression, events, objects, guidance and
lantern interpretation without mutation. `StoryActions` translates authored
outcomes into a typed command sink supplied by the existing store. The physical
and accessible journeys use the same dispatch; compatibility exports remain.
App uses the location selector. The text/WebGL capability probe moved into
`experience/ExperienceRouter`, including explicit text routing and disposal of
its temporary WebGL2 context. No save version, ID or prose changed.

The progression source-string guard in `final:world` now executes the narrative
foundation tests. Frozen snapshots, every canonical scene, every legacy act
condition, all authored outcome types, explicit false/default values and
physical/text command agreement are covered. Merely evaluating the runtime
cannot witness an entry, award inventory or progress the story.

Validation: `npm run check` passed (939 unit tests, 7 session-security tests,
integration/lint, 66-entry content QA, asset/world guards, production build and
Pages Functions compilation). `npm run test:e2e -- e2e/accessible-journey.spec.ts
e2e/cloud-journey-sync.spec.ts --project=chromium --project=mobile-chromium
--reporter=line` passed all 16 tests in 4.1 minutes, including complete 32-scene
text journeys, private prose, explicit Heart/Womb choices, restore-before-write,
disconnect races, offline retry and intentional reset precedence.
The compiler-generated `worldState` removes a historical duplicated lookup;
that unrelated generated-file change is excluded from the foundation commit.

Browser workflow: the optional Browser plugin is not installed. The available
in-app browser is used for manual rendered inspection, and the existing
Playwright installation runs the repository's requested regression tests.
Manual baseline inspection verified the restored First Wood and Fragment with
no browser errors. This is baseline inspection, not proof of the later visual
rebuild. The generated opening concept is a composition reference; its bitmap
is not a production environment asset or a substitute for the walkable world.

### Phase 2: physical controllers and camera ownership

`StoryScene` decreased from 7,203 to 6,148 lines. Numeric movement, keyboard/touch
input, Rapier stepping/slopes/gravity and grounded pose belong to
`player/PlayerController`; it imports no narrative state and never writes the
camera. `CameraController` owns arrival, pointer lock, queued look, mobile look,
pitch, head bob and gentle assistance. The shared presentation clock executes
at -3, movement at -2 and the sole live camera writer at -1. The historic
cinematic camera is a guarded standalone review adapter. StrictMode readiness
follows actual arrival rather than an effect replay. Inactive input clears
queued movement/look to prevent a burst after returning from settings or blur.

`InteractionController` and `interactionFacts` report range, gaze, proximity and
threshold facts. They cannot dispatch story outcomes. The existing narrative
receiver still determines admission, eligibility, timers and consequences.
`world/guidance/GuidanceController` retains the existing ranking, 80 ms sampling,
200 ms UI publication, six-metre spatial window and threshold hysteresis.
Saved safe-pose validation, canonical terrain conversion, all IDs/schemas and
the mounted MasterPlayerLantern remain unchanged. The unreachable local lantern
function had no mounted instance and was removed; the one-carried-lantern guards
remain. CI path filters now cover the extracted owners.

Validation: `npm run check` passed with 963 unit tests, seven security tests,
66-entry content QA, typecheck, integration/lint, asset/world validation,
production build and Pages Functions compilation. The focused player suite
passed 104 tests. The initial desktop/mobile browser run passed all seven
applicable touch cases and skipped five desktop-only cases on mobile, but four
desktop cases timed out during a host sleep. Mac power logs and trace timestamps
confirmed the execution interruption; the failed traces/logs are retained in
`artifacts/rebuild-20261005/phase-2/initial-browser-results`. With no code or
deadline changes, the desktop rerun of opening and keyboard suites passed all
three tests in 38.4 seconds. These exercise two real wipes, restored reveal,
pointer handoff, modified/composing key rejection, touch movement/look,
interruption cancellation and route-preserving mode changes. Actual desktop and
mobile stage captures were inspected. Logs and verified captures are retained
outside source under the phase-2 artifact directory.

### Phase 3: terrain, forest, air and route owners

The terrain sampler, exact seeded route builder/packing/caches, ground worker,
forest instancing/worker/colliders, texture lifecycles, moon/horizon/panorama,
fallback weather/atmosphere, and route ribbons/landmarks now have actual owners
under `world`. StoryScene retains orchestration and canonical/fallback gates,
and is about 2,880 lines. Of 117 moved declarations, 116 remain identical to the
Phase 2 implementation; HillyForestGround delegates its unchanged construction,
index copy and worker upload to the executable `terrainGeometry` adapter.
The newer OutdoorLandscape, biome ecology, grass/flowers, river, material and
worker implementations remain intact. Hidden opening visuals still keep terrain
and forest physics/workers mounted; recoloring does not rebuild a collider.

An independently executed committed-source fixture protects all 65 packed paths,
66 clearing positions and six terrain samples across morph states. Executable
tests compare visible triangle raycasts to collider sampling, worker vertex
uploads and recoloring, quality-independent topology, and outdoor/ecology quality
prefixes. AST dependency checks prevent world-to-scene runtime cycles, narrative
imports in physical detectors, stateful terrain calculations and broken worker
URLs. Source guards now inspect each actual owner and its composition mount,
rather than a concatenation of world sources. Visual CI filters cover `src/world`.

Validation: `npm run check` passed with 973 unit tests, seven security tests,
content QA, source/type checks, production assets/world, build and Pages Functions.
The 163 focused tests passed. `review-forest-production` rendered 14 baseline and
candidate captures across high, medium, low and cinematic tiers, portrait and
landscape mobile, and reduced effects. Every comparison has exactly zero change
in draws, triangles, textures and lights; instance counts and camera placement
also match. Both worker upload and deformed terrain readiness were required.
Desktop high and portrait low captures were inspected. Reports/captures and
the immutable Phase 2 source are outside source in
`artifacts/rebuild-20261005/phase-3`; declaration/golden-generation evidence is in
the adjacent `phase3-world` directory. Routine compiler output was excluded only
after confirming every canonical entry remains identical.
The built application's five mobile exploration cases also passed in 59 seconds:
persisted handedness, portrait/landscape map tabs, route-preserving guidance and
recovery, input interruption/cancellation, and real touch movement/look telemetry.

Remote follow-up: the full regression and visual runs could not acquire hosted
runners and executed no source checks. The smoke workflow did run its unit suite
on Linux/Node 22: 972 of 973 passed. The new path golden comparison rejected native
trigonometric differences of roughly 1e-12 to 3e-12 world units. Its portability
repair retains exact path seeds, endpoints, bounds, keys and topology flags, and
allows at most 1e-10 world units only for derived control points and integrated
arc length. Physics tolerances and draw/asset budgets remain unchanged. The
original failed log is retained in `phase-3/smoke-ci-failure.log`; hosted runner
annotations and retries are recorded separately from application failures.

The portability repair is committed as `f876e13`. Its current remote full
regression run (`37430617082`) passed the Linux/Node 22 source, unit, security,
production build and Pages Functions job, as well as decoder-delivery validation.
Four browser jobs subsequently passed. Mobile Chromium passed 47 cases, skipped
three, and failed only the injected forest-worker network-error recovery case;
its failed trace and network evidence are retained in
`phase-3/ci-mobile-worker-failure`. Recovery diagnosis is in progress without
changing its existing deadline or discarding network-abort coverage. Fresh smoke and visual
workflows were dispatched against the repaired main revision (`37431107513` and
`37431112137`). The latter Visual presentation review passed; historical failed
runs remain available. The repaired Story interaction smoke run also passed its
source/build job and all six physical, opening and semantic desktop/mobile lanes.

### Phase 4: canonical presentation and bounded compatibility

`SceneLookDirector` remains the sole canonical global presentation authority.
The actual light implementation is now in `world/lighting`; canonical fog/sky,
mist, shafts and airborne particles are in `world/atmosphere`. Historic
artDirection imports reexport these implementations. The procedural fallback
atmosphere is explicitly named `LegacySceneAtmosphere` and fallback narrative
lighting has its own world lighting owner.

The carried lantern and motivated local chapter lights remain specialised
presentation. Nested SceneLook, cinematic adapters, old world rigs and chapter
keys suppress their subscribing implementations before mounting when the
canonical context is present. Canonical `WorldEngineLayer` mounts no fallback
ground, veil, breath or path subscribers. Its only useful ambient particle draw
has moved to SceneLook; the unused former particle component was removed.
The wrapper retains exactly its map/opening lantern-inventory-or-ritual gate,
quality scale, reduced-effects suppression and epilogue suppression. The full
WorldDirector aggregate and duplicate visual projection now execute only for
fallback presentation or explicitly enabled debugging.

One shared activity policy suspends presentation clocks for hidden/unfocused
pages, settings, reading, maps and paused physics. The shared clock still runs
at -3, before player -2 and camera -1; sky following now runs at 0 after the
camera. Atmosphere ownership restores the preceding live values, including
StrictMode replay and out-of-order cleanup, without displacing external changes.
No persisted field or progression action was introduced.

The independently executed pre-consolidation fixture protects particle counts
for all 32 scenes, four qualities and both effects states, as well as exact
Float32 seeds and quality prefixes. Activity and atmosphere cleanup have
executable tests. AST composition guards check the one carried lantern and
canonical lighting, atmosphere and particle owners, including historic import
paths. Independent review confirmed identical light/mist/shaft/fallback bodies,
byte-identical shader strings, fog formulas, light constructors and shadow bounds.

Validation so far: 173 focused tests, typecheck, lint, final-world checks and
fixture compilation passed. Root's `npm run check` passed with 987 unit tests,
seven security tests, content/assets/world validation, build and Pages Functions.
The first lifecycle render obtained the underfloor high-quality evidence, then
hit the existing screenshot deadline while the production build was running.
Its report and `initial-lifecycle-failure.log` remain in the phase-4 artifacts.
An unchanged, isolated rerun is underway; rendered lifecycle and production
comparisons must pass before this phase is committed.

That isolated run reached natural mirror stillness and exposed a stale live
reflection uniform: when turning away, the offscreen mirror retained its prior
disturbance because updates occurred only after capture admission. Actual images
confirmed the camera was facing away from the mirror. Surface time/disturbance
now consume shared presentation in the existing -2 frame subscriber. Formulas,
capture cadence, recursion/distance/visibility guards and render targets are
unchanged; no subscriber or pass was added. Two executable contracts and the
existing scene-look/presentation tests pass, as does typecheck. The zero
disturbance assertion remains intact; `mirror-lifecycle-failure.log` and its
captures are retained, and the lifecycle run is repeating against the repair.

The repaired mirror checks passed in later full-sequence runs on SwiftShader and
native ANGLE Metal (Apple M1). A separate unchanged run timed out at natural
stillness; its `lifecycle-fixed.log` remains available and its cause is not
established. Full-sequence quality cycles then exposed texture growth of 7/8/9,
with unchanged geometry counts. Fresh Blue Moon isolation remained 4/4/4.
Allocation tracing identified shadow-pass uploads rather than leaked finishing
targets, and an independent CPU reproduction against installed Three confirmed
that its shared depth material can retain a disposed source map in a uniform
after the next caster has no map. The strict lifecycle assertion remains in
place. All failed reports and captures remain in
`phase-4/lifecycle-resource-trace` and `phase-4/lifecycle-native-trace`.

The repair now uses the supported R3F material attachment lifecycle to give each
tactile caster a private directional/spot depth material. It borrows the live
surface maps, applies the existing UV guard before shadow shader selection,
invalidates only changed sampler/alpha features, and restores preceding bindings
on cleanup. Existing explicit depth owners remain external; borrowed textures
are never disposed. No new texture, pass, frame subscriber or global Three patch
was introduced. Eleven executable tests include the installed Three CPU
reproduction, UV admission, feature changes and both ownership cleanup orders.

The final `npm run check` passed with 1,001 unit tests and seven security tests,
source/type checks, exact 66-entry content QA, asset/world validation, production
build and Pages Functions compilation. The complete native ANGLE Metal/Apple M1
lifecycle passed with no errors: underfloor parallax and all quality tiers,
natural and assisted mirror stillness, restored motion, three cinematic-to-low
cycles, settings/physics clock suspension, Surrender, actual reverse journey
geography and single ending completion, atmosphere unmount/remount restoration,
and canonical wrapper/Seer ownership. Quality cycles remain exactly 31 geometries
and five textures each. Its report and actual captures are in
`phase-4/lifecycle-accepted`. This establishes desktop GPU behavior; it does not
certify sustained physical-mobile frame pacing. Fixed-camera production review
captured 12 baseline and 12 candidate images for First Wood, Blue Moon, Thorned
House and River, including high desktop arrival/detail and reduced-effects low
portrait arrival. Every matched capture retains exactly the same draw calls,
triangles, geometries, textures, lights and shadows. Desktop and portrait images
were inspected against the baseline; existing compositional limitations remain
for the requested art phases. Reports and PNGs are in
`phase-4/production-comparison`. The built desktop/mobile Chromium opening and
keyboard suites passed five tests in 1.3 minutes, with the desktop-only keyboard
case correctly skipped on mobile. These exercise actual mouse/touch wipes,
persisted stage restoration, inversion and click handoff, modified/composing key
rejection, and the ordinary-key positive control. Actual earned-stage captures
are retained in `phase-4/browser-accepted`. Phase 4/A is accepted for commit.

Worker recovery remains separate from this presentation acceptance. An isolated
CPU reproduction with installed React 18 confirms that a retained worker's local
error can stay behind a newly suspended parent until its promise resolves; an
outer DOM-owned failure signal recovers immediately. This supports a bounded
robustness repair, but does not establish the exact intermittent CI cause. The
local desktop failure contained no recorded worker request and therefore is not
evidence of failed worker error propagation. Original abort coverage, deadlines,
failed logs and traces remain intact.

### Worker recovery after presentation consolidation

Both actual worker owners now report current-worker failures through a stable
React context callback to local `WorldCanvas` error state above scene Suspense.
A guard inside the existing DOM recovery boundary throws there immediately.
Local render-time errors remain for direct source fixtures. No global event bus,
story state, renderer timeout or worker payload changed. Terminated/replaced
workers cannot publish late failures. Three executable React/domain tests cover
the retained pending parent, current callback identity and stale worker rejection.

`npm run check` passed with 1,004 unit tests, seven security tests and all source,
content, asset, build and Pages Functions checks. The built original network-abort
case passed on desktop and mobile Chromium. The first added startup-exception
case passed on mobile but failed on desktop; the retained trace records the first
worker requests 33.85 seconds after Begin, after the full 30-second recovery
assertion had already expired. It does not demonstrate failure of the reporter.
The new exception case now explicitly requires a fulfilled injected worker
request within 60 seconds before measuring its unchanged 30-second recovery
deadline. Its overall budget allows that startup, recovery and text-continuation
sequence. The original abort test and end-to-end deadline remain unchanged.
Both cases subsequently passed on both Chromium projects, four tests in
1.5 minutes. The failed and accepted records are respectively
`phase-3/worker-recovery-accepted` and `phase-3/worker-recovery-bounded`.
Slow startup is not claimed fixed, and a green complete hosted browser matrix
is not inferred from these targeted checks.

The full hosted run for `ae8fd04` (`37437608130`) subsequently succeeded:
Linux source/build/Pages Functions, decoder delivery and all five browser jobs.
The visual run (`37437608440`) also succeeded, and Cloudflare Pages deployed.
This was not a clean first-attempt browser result. Desktop Chromium reported
45 passed, five skipped and two flaky cases; mobile Chromium reported 48 passed,
three skipped and one flaky. Both worker-startup fixture cases retried before
succeeding, and desktop's completed 3D constellation remained in its forming
phase beyond the 40-second assertion on its first attempt. Mobile WebKit passed
38 with 14 skips; Firefox and WebKit each passed 37 with 15 skips. Full hosted
logs and failed retry excerpts are retained in `phase-b/ci-ae8fd04`. The existing
workflow uploads browser diagnostics only on terminal failure/cancellation, so
these retry-green jobs did not retain their generated failure traces. The logs
support the above observations, not a diagnosis of their exact causes.

### Updated visual-world brief and execution order

The October 6 brief adds a forest-first art pass after presentation consolidation.
It preserves the current HEAD, extracted physical/world owners, canonical story
and save schemas, shared SceneLook, asset review gates and all comfort modes.
After Phase 4/A acceptance, work proceeds through B forest silhouettes/floor/depth,
C opening and first physical route, D quiet UX and guidance, E material expansion,
F chapter-by-chapter composition, G Constellation, and H photo/audio capability.
The earlier manifest/runtime and final cleanup requirements remain part of the
rebuild and will be integrated where they support these stages. No finished
production hero or recording is inferred from the existing fallback slots.

The current forest audit confirms a single shared trunk and seven sphere-lobe
crown geometry, with only three scale habits, rather than distinct archetypes.
Continuous terrain already has route/moisture/moss/ash masks, but the richer
terrain-aware habitat is limited to authored landscapes. Existing forest review
limits remain zero additional draws/lights and at most 13,000 additional
triangles, with exact worker populations and camera placement. Morph-based
authored silhouettes can preserve the two tree draws; their weights must be
allocated against full instance capacity before the worker sets active count to
zero. Actual captured low/high forest views confirmed visible faceting, repeated
crowns and sparse ground; they remain the visual baseline for this next stage.

### Phase B: authored forest silhouettes, contextual ground and depth

The actual geometry owner is now `world/forest/forestGeometry.ts`; the historical
environment path reexports its public constructors. Eight authored spines,
forks and separated canopy islands form old-broad, narrow-reaching, broken,
twisted, leaning, young, partially-dead and open-canopy silhouettes. They share
topology for instanced position/normal morph targets. Ordinary geometry remains
morph-free for chapter and far-wood consumers. Opaque folded foliage replaces
the sphere lobes, with open sightlines and no additional tree draw.

Continuous and clearing forests allocate one-hot weights against the full
constructor capacity before the asynchronous worker sets active counts to zero.
Archetypes follow quantized world coordinates rather than packed instance
indices. Crown presentation follows the existing trunk matrix through its
reference local transform, so branches support the canopy despite independent
historic crown yaw and anisotropic scales. Worker generation, trunk matrices,
colors, tree counts, colliders, terrain sampling and canonical paths remain
unchanged. Quality changes replace and dispose shared geometry; mesh-owned
weight textures have independent cleanup. Far woodland keeps two ordinary
draws and uses the low crown geometry at every tier.

The original moonlit-path understory draw now contains a bounded selection of
fern, grass, flower, litter, deadwood, wet-bank and charred forms. Canonical
source/target scene habitats blend along the existing route, including Fire's
dry retreat and River's wet bank despite their shared technical biome. Existing
8/16/24/28 populations and path-side exclusions remain; matrices sample actual
terrain slope. Reusable instance buffers vary forms and palettes without new
textures, lights, colliders, frame subscribers or story state.

The sole SceneLook atmosphere can reduce its existing fog density for authored
long sightlines. Existing ground-mist banks translate outside the focal corridor
while preserving their count, depth, scale and shader. No uniform density
increase or second atmosphere owner was introduced.

The first valid neutral geometry gallery exposed foliage that was too small
and horizontal to support the tree silhouettes. That art candidate was rejected;
its captures remain in `phase-b/archetype-gallery-accepted` (the directory name
predates the visual rejection). Revised folded sprays have visibly larger,
varied pitch and roll while retaining the original triangle limit. Independent
review then found two compatibility issues: ordinary consumers needed opaque
two-sided foliage, and bark closing faces needed duplicated UV seam vertices.
Both are corrected. Trunks remain 292 triangles; the UV repair changes their
vertices from 172 to 208 and adds 9,216 bytes to the packed eight-target trunk
texture, without adding a texture object or draw.

Validation is in progress against the frozen corrected source. The first full
check passed 1,039 unit and seven security tests; it precedes the seam correction
and new lifecycle checks and is not final acceptance. Initial paired canonical
captures and raw forest review passed their budgets. A subsequent single-frame
capture failed the Blue Moon draw budget; its report remains in
`phase-b/canonical-final-comparison`. The review now records eight consecutive
completed GL draw samples and compares their peaks, including the existing
alternating reflection cadence, with identical fixed cameras and lenses.
Zero additional draws/lights and the 13,000-triangle ceiling remain unchanged.
Final native comparisons, resource lifecycle, full checks and built interaction
checks are required before this phase is accepted.

The corrected pre-initialization-repair source passed all 13 canonical pairs:
exact camera/lens and equal draws, lights, shadows and geometry counts; four
additional morph textures; low triangles +1,186 and all high/cinematic cases
lower. The final raw-forest review passed seven pairs, with equal draws/lights,
exact worker counts and at most +3,596 triangles. Its fallback clearing owns
seven added morph textures rather than canonical's four. Native final neutral
galleries also passed. The full check passed 1,046 unit and seven security tests,
and native built opening/keyboard checks passed five with one correct mobile
skip. These reports precede the separately diagnosed ground-detail repair below.

The first retained-Canvas lifecycle failed when a fully warmed world was compared
to a fresh remount (geometry 50→49, programs 93→44), although all four forest morph
textures and observed owner geometries were released on unmount. Instrumented
diagnostics identify two distinct causes. Three releases a live material's cached
shader variants on disposal, so equal shader counts require equally warmed
material lifetimes. The missing 272 triangles are an existing initialization
race in `NarrativeGroundDetailField`: a passive mount effect can reset the root
and leaf counts after its first frame populates them and caches the cell. The
counts return only after a cell or quality change. Draw inventory identifies
11 root-cylinder instances (264 triangles) and two double-sided leaf planes
(eight triangles); compared journey state and camera projection are identical.
Reports are retained in `phase-b/forest-lifecycle-metal` and
`phase-b/forest-lifecycle-diagnostic`. The initializer now runs in the existing
owner's layout phase and invalidates the complete cached cell signature before
resetting counts. This preserves authored populations, geometry, seeds, sampling
and the original frame subscriber.
Final canonical review retains cold costs and compares identical explicit quality
warmups before measuring the forest-library budget. It must not hide the restored
ground-detail draws in a cold-start claim.

The repaired source passed 1,051 unit and seven security tests, plus the complete
content, asset, world, lint, type, production-build and Cloudflare checks. Built
desktop/mobile opening and keyboard tests passed five with one correct mobile
skip. The actual-owner CPU tests reproduce both the former passive-reset race
and a layout-only fix's retained-Suspense failure. They verify cold parity,
StrictMode replay, exact quality/matrix parity, real retained reconnect and
geometry disposal; independent review reran all five successfully.

All 13 final canonical pairs in `phase-b/canonical-warmed-comparison` passed with
exact camera pose/lens, equal draws, lights, shadows and geometry counts, and
four additional morph textures. Low quality adds 1,186 triangles; high/cinematic
cases use 32,984–78,620 fewer. Each side records cold costs, then exercises the
same alternate/requested-quality sequence before collecting eight completed GL
draw samples. Cold costs include restoration of zero to eight existing ground
draws (Blue Moon's reflection repeats four ground draws). These costs remain
separate from the forest-library comparison. Source hashes confirm the captured
production source is unchanged. This is measured on native Apple M1 / ANGLE
Metal; it makes no hardware FPS or unseeded full-journey claim.

The final native retained-Canvas lifecycle in `phase-b/forest-lifecycle-final`
passed 121 captures and 59 exact comparisons. Three actual world mount lifetimes
follow the same route/Fire/River warmup and two quality waves before comparisons
at matching phases. The first lifetime then repeats three measured waves; later
lifetimes repeat one each. Geometry, texture, native texture and shader counts
match exactly at each phase, as do camera/lens, seeded journey presentation,
worker uploads and world-coordinate families. Every unmount releases both
target textures, both weight textures, all observed owned geometries and both
workers. Empty worlds consistently retain zero geometries, two shared loader
textures and one cached renderer program. No GL/browser/resource request errors
occurred. All six lifecycle contract tests passed after the runner was frozen.

Phase B's bounded shared-forest implementation is accepted with the stated art
limitations below. The runtime/manifest migration follows before the opening
pass so that physical and accessible interactions share the same explicit
authorization, foreground time and canonical command interpretation.

This is a bounded improvement to the shared forest. Captures still show angular
foliage, some pole-like mid/far trees and sparse broad ground. It does not certify
finished production environment art or complete the later material, physical
composition and opening requirements. No hero GLB or recording is relabelled
as production.

The pushed forest commit `ba17491` subsequently passed all three GitHub workflows:
story interaction smoke (`37445479386`), full mobile/browser validation
(`37445479447`) and visual presentation review (`37445479448`). Every job in the
five-browser matrix succeeded. Raw logs and final metadata are retained in
`phase-b/ci-ba17491`.

### Phase 5: live scene manifest and single narrative command runtime

`StoryManifest` derives all 32 scenes and twelve chapters from the existing
canonical registries. It references their environment cues, keystone/echo IDs,
layout, existing lighting/atmosphere/look/camera/audio profile keys and actual
event/object/target IDs. It carries no prose or progression outcomes. Twenty-two
scenes use the existing authored arrival; ten retain the active-fragment camera
offset fallback. Actual `StoryScene` arrival/grounding/saved-pose initializers
are compared to an immutable pre-migration fixture across all 66 entries,
walk/orbit/read modes, terrain cases and accepted/rejected saved positions.
`JourneySceneDirector` and `SceneLookDirector` consume the manifest's real
layout/chapter/profile references without a second presentation authority.

`StoryRuntime` is now a live instance-local command authority around the sole
persisted `useJourneyStore`. The DOM `StoryRuntimeProvider` owns its lifetime
and one advancement scheduler. Begin/Continue explicitly authorize scene entry;
navigation, read/witness, ritual, legacy action, story event and drop intents
use current canonical state and opaque entry/scene/relocation leases. Accepted
commands settle only authored consequences whose requirements are already
earned. Constructing, binding, rendering, deriving, observing, reconnecting and
disposing the host do not infer a story action. No runtime token or timer is
serialized, and save key/version/schema remain unchanged.

`JourneyDirector`, `StoryEventDirector`, `AccessibleStoryJourney` and
`AccessibleStoryObjects` now submit IDs to that command authority. The runtime
owns authored event attention and beat timing; adapters publish range/gaze/UV
gesture eligibility and read progress projections. Continuous attention resets
on interruption; sequence playback retains only foreground time already seen.
Settings, archive, focus, visibility, page lifecycle, mode, physics and input
interruptions invalidate the appropriate physical continuity immediately,
including between camera samples. Retained Suspense reconnect may renew prior
explicit authorization; a changed entry, scene or restoration revision requires
a new explicit command.

The existing camera's final-pose callback publishes one numeric sample to a
renderer-free observation port. The port owns no store, DOM listener, scene ID
or clock. It rejects missing, first, invalid, backwards or stale samples and
reports normalized linear/angular speeds plus held keyboard/pointer activity.
Stillness intentionally removes the old frame-rate bias: its intended 75 ms
limits become 0.4 m/s and approximately 0.3373 radians/s at every frame rate,
with the existing 350 ms input idle requirement. This changes the former
30/60/120 Hz admission ceilings of 0.30/0.36/0.40 m/s and
14.49/17.39/19.33 degrees/s; it does not alter camera/player motion. Actual camera
fixtures compare 840 supplied-time frames, and physical attention tests cover
all seventeen authored durations at 30/60/120 Hz.

Clearing presence reports at the existing 80 ms physical cadence independently
of the unchanged HUD signature/cadence. The rendered source closes over entry,
scene and relocation revision. The DOM host combines that report with fresh,
settled camera samples before admitting a witness once per scene lease. A
threshold report only queues an observation; the same DOM scheduler rechecks
its lease, scope, current target distance, settlement and age before navigation.
This keeps canonical mutations out of renderer callbacks and rejects old
reports after settings, navigation, restoration and cleanup.
Thresholds additionally require a fresh settled outside receipt before entry.
The former initial-inside behavior could silently navigate from the canonical
031/048 arrival, which is 2.7 m from 032's 3.15 m threshold. Actual controller,
host and source-callback tests now reject default/saved stationary arrivals,
clear the earned edge on suspension, and accept a new outside-to-inside walk.
Queued/rejected observations retry only on the existing physical sample; legacy
synchronous consumers retain their exact earlier hysteresis and cadence.

`useStoryNavigation` now owns both click and keyboard command paths with fresh
canonical reads and unchanged capability/interactive-element/modifier guards.
Archive buttons have a synchronous exception only for explicit navigation,
back and Begin/Continue: physical/timed actions remain suspended, while
Settings, readiness and foreground still block the command. Fragment opening
requires witnessed content, and reader paragraphs are guarded before rendering.
The map's F shortcut uses an explicit current-entry reading handoff without
enabling map attention.
If a later successful cloud retry invalidates the current lease, the active
shell returns to the existing explicit Continue gate. That handoff changes UI
participation only; it cannot mount a scene event, witness or outcome. Actual
same-entry hydration tests cover the loss before the first scheduler sample and
after settled poses. Accepted navigation and retained reconnect install their
replacement authorization before sampling and do not trigger this handoff.

Actual-store core tests cover the fresh complete
32-scene route, all 34 authored scene-entry events, every legacy action/choice
and ritual, private prose and exact serialized compatibility. Actual React
host/navigation tests cover StrictMode, retained reconnect, old publishers,
single scheduling, archive handoffs, between-frame interruption and queued
crossings. Full production checks and built desktop/mobile journeys must pass
before committing this phase. Source guards are migrated to the actual owners
and strengthened with executable behavior; the former failed reports are
retained in `runtime-host-preparation`.

The final full check passed 1,133 unit and seven security tests, canonical content
QA, source/world/asset validation, TypeScript, production build and Pages
Functions compilation. Phase 5 was committed and pushed as `21ce695`. Eleven actual React host tests and twelve controller/
navigation tests cover the interruption and arrival repairs. Initial built
text/cloud validation passed all nine mobile cases and five desktop cases;
three affected desktop cases subsequently passed unchanged on recheck. Failed
reports remain in `browser`, `browser-recheck` and `browser-awake`. The Mac power
log confirms repeated Clamshell Sleep during these runs; trace predicates with
15/35-second limits include gaps of 408/426 seconds, and one before-page hook
includes a 1,046-second gap. The idle-sleep hold cannot override a closed lid.
The latest interrupted desktop route reached the Epilogue's reverse-light
sequence. Awake final-build browser acceptance remains required.

Awake final-build acceptance completed the full 32-scene text journey on both
desktop and mobile, including the Heart/Womb choices and ending. The new
same-entry late-cloud retry passed on both projects; its exact save assertion
includes the pre-existing safe-entry normalization performed by hydration.
The final native ANGLE/Metal physical/restore/keyboard run passed nine cases
with one intentional mobile keyboard skip. It preserves the real two pointer
wipes and touch before inversion, earned reveal restoration, pointer handoff,
rendered stage receipts and modified/composing keyboard rejection. Actual
desktop and portrait stage-two images were inspected. The retained initial
cloud assertion failure was an expected-navigation-metadata mismatch, and the
corrected test continues to compare every serialized field/schema and forbids
mounting new progression. Final reports are `browser-final` and
`browser-physical`; earlier sleep-interrupted reports remain intact.

The first remote Phase 5 smoke run exposed a genuine DOM-input regression:
capturing window `focus`/`blur` also observed descendant buttons. Moving focus
onto the physical floor action cleared its valid camera observation immediately
before its click. The bridge now handles only focus events targeted at the
window itself. Actual window blur, page lifecycle, visibility, pointer-lock and
overlay interruption retain their fresh-continuity requirements. A new CPU
case covers descendant focus and real window suspension. The unchanged native
desktop/mobile `scene-polish` tests now pass both cases, including jitter
rejection, both reveal stages and Continue after reload. The original failure
reports are preserved in `browser-scene-polish-repro`; accepted reports are in
`browser-focus-repair`.

The visual review now waits for the actual onboarding-action opacity within
the same 2,500 ms deadline instead of an unconditional sleep. All original
visibility, centering, overflow, identity and Begin checks remain. Its native
Metal run passed all thirteen captures, including desktop, portrait and
landscape production entry. Evidence is retained in `visual-focus-repair`.
The prepared Phase C working tree also passed 1,169 unit tests, seven security
tests, source/lint checks, type checking, content/asset/world validation, the
production build and Pages Functions compilation. Remote browser regression
jobs for `21ce695` still require their failure audit and a repaired-commit run;
these local receipts do not certify those remote jobs.
