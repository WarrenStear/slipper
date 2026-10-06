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

## Current architecture: evidence from the mounted application

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
| 4. Presentation | Canonical light, fog, sky and particles; early compatibility gates and shared presentation activity. | Implementation ready; full check passed, rendered lifecycle and production comparison underway. |
| 5. Manifest | Derive presentation, spawn, profiles and interaction references from canonical scenes. | Pending. |
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
