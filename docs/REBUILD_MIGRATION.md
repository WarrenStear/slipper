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
`artifacts/rebuild-20261005/baseline-budget-repair`.

| Phase | Implementation | Validation / status |
| --- | --- | --- |
| 1. Foundation | This document first; shared narrative selectors/actions/runtime; used compatibility boundaries. | Complete (`1ae2b98`): full check and 16 desktop/mobile text/cloud browser tests passed. |
| 2. Player | Input, movement, camera, factual interaction detection; one ordered camera writer. | Pending Phase 1 validation. |
| 3. World | Exact terrain/forest/guidance/atmosphere extraction; preserve ecology and seeded paths. | Pending. |
| 4. Presentation | Preserve canonical SceneLook owner; consolidate/remove proven redundant rigs. | Pending. |
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
