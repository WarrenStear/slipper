# Continuous world rebuild — implementation and qualification

## Scope and baseline

This is a working continuous-world increment, not a claim that every destination now has finished cinematic production art. Work started from `33775918fb8b3be9db7db305272a699fb84d2f3b` on the active `WarrenStear/slipper` repository, on branch `codex/continuous-world-rebuild`. The previously configured local `main` and its unpushed commit were preserved. The retired `warrens-alt/slipper-in-the-woods` URL was unavailable; the checkout and README identify the replacement repository.

The latest main-branch runs inspected were all successful: [story interaction smoke tests](https://github.com/WarrenStear/slipper/actions/runs/37923934299), [visual presentation review](https://github.com/WarrenStear/slipper/actions/runs/37923934321), and [mobile exploration / reading validation](https://github.com/WarrenStear/slipper/actions/runs/37923934335). These are baseline results, not remote CI results for this branch.

The audit covered the project README, package/toolchain, architecture and visual bibles, cinematic/pacing documentation, production optimization notes, App/WorldCanvas/StoryScene composition, chapter and environment owners, story event authority, player controllers, world workers, asset declarations, tests, and workflows. The current baseline already contained extensive work absent from the older local checkout: shared terrain, a Rapier capsule, canonical event validation, atmospheric ownership, accessible storytelling and authored chapter compositions. Those systems were retained.

The specifically named WhatsApp `(4)` export was unavailable. The local unnumbered ZIP contained one chat text and 34 images, including the approved willow/key language. It was inspected in a private temporary directory and removed immediately. No raw conversation, private image, or withheld passage is included in this branch. The existing approved archive remains authoritative; original reference images were not overwritten.

## Implemented behavior

- **Physical geography follows the player.** `sceneStreaming.ts` admits actual authored chapters by distance to their footprints, independently of narrative prerequisites. Eight-metre camera cells, fourteen metres of retention margin and fixed tier caps bound updates and avoid boundary churn. Distant chapter geometry and colliders are evicted. The enclosed opening remains separately gated.
- **One story input owner survives streaming.** The active scene retains one `StoryEventDirector` and one carried-object presentation. Its world objects can leave residency without removing carried objects or inventing another event path. `StoryObjectPresentation` projects existing object states and placements into nearby scenery without input listeners, prose or dispatch. Scenery object names cannot satisfy active interaction lookups. Shared objects receive one scenery residence derived from their accepted event history, preventing duplicate placed lanterns and baskets across neighbouring scenes.
- **Places do not move when narrative focus changes.** Each chapter resolves its own X/Z anchor and shared terrain height. The old translation of the entire rendered neighbourhood by the active scene's origin is absent from the continuous world.
- **Scenery uses the shared walking surface.** Continuous chapter ecology follows the global height sampler. The old chapter-local hill panels and river cuts remain available to isolated art reviews; they are not stacked over the continuous terrain. The sanctuary and canonical river water compositions remain. This removes overlapping terrain and collision surfaces; the wider river network still needs a separate geography pass.
- **The optional Willow Refuge is real geography.** A leaning forked tree, exposed terrain-following roots, hanging lanceolate leaves, fern and rush clusters, a shallow pool and two connecting earth routes occupy the western first woodland. The pool depression reaches the terrain worker and collider. Its flat water boundary is fitted to that exact quantized surface. A small unclaimed key adds no event, inventory item, prose fragment or completion condition.
- **Raised surfaces support walking.** The sanctuary bridge has a deck collider, matching approach steps and rail support. The player fallback no longer pulls a Rapier-supported capsule down through a bridge or stair toward the underlying landscape. A real Rapier test traverses the complete span and returns to ground level.
- **Existing visual authority is retained.** Nearby scenery receives base material detail, no extra hero reflections, no duplicate moon, and no local story lights. The current scene owns those additions. The woodland has a brighter canopy key and fill within the existing `SceneLookDirector`. Distant backdrop silhouettes are excluded from the near field as the player walks toward them.
- **Central scene composition is smaller.** Ground details/trails, environmental breadcrumbs and semantic path decoration moved to `src/world/ecology/`. The central scene fell from 2,865 lines to roughly 1,770; progression, input authority and approved source content remain in their original domains.

## Canonical content and memory

[The generated source-to-world map](CONTINUOUS_WORLD_SOURCE_MAP.md) covers all 12 chapters, 32 scenes and 66 approved fragments. It records dramatic purpose, tone, symbols, landmarks, natural environment, eligible interactions, persistent consequences, exact source references, body hashes, revisits and accessibility equivalents. Regenerate it with:

```sh
node --experimental-strip-types scripts/write-source-world-map.mjs
```

No chapter, scene, fragment, event, save version or inventory schema was added or renamed. The 65 existing physical story links are preserved; the willow's nine path segments and clearing are geography-only seeds. Accepted events, object states and placements remain the evidence used on reload and revisit. Burned/released/carried objects are not copied into scenery. The unfinished epilogue appears as a quiet physical place rather than replaying the ending. Optional scenery does not bypass unread-prose protection or accessible-story prerequisites.

## Asset provenance and budgets

All new runtime geometry is authored in repository code using the existing Three.js geometry helpers. It adds no remotely hosted media, model downloads or package dependencies. The subsequent graphics pass adds three locally generated material textures with provenance and exact prompts in [GENERATED_MATERIALS.md](../public/textures/forest/GENERATED_MATERIALS.md). These are generated approximations, not scanned PBR materials. The generated willow concept remains a local visual reference only, not a runtime skybox or a replacement for original imagery. Existing production-asset admission and placeholder declarations remain unchanged.

| Quality | Additional nearby scenes | Radius before retention | Willow trunk/branches + leaves |
| --- | ---: | ---: | ---: |
| Low / reduced effects | 3 | 48 m | 13,888 triangles |
| Medium | 4 | 56 m | 13,888 triangles |
| High | 5 | 64 m | 36,544 triangles |
| Cinematic | 6 | 72 m | 36,544 triangles |

The active chapter is additional only while physically nearby. Understory, pool and path geometry have small fixed counts. The willow uses bounded merged meshes; its detailed subtree has 105/125 metre enter/exit distances. Scenery-only material detail is base regardless of the player's main quality tier. The distant woodland keeps two instanced draws and repacks at camera-cell boundaries. The existing hero-reflection budget remains authoritative.

## Reproducible review

Use Node 24.15.0 and npm 10.9.2 (the repository supports Node >=22 and <25). Browser plugin was unavailable; visual testing uses the repository's pinned Playwright installation. The new review script creates a disposable local fixture using the real `StorySceneWithMasterLantern`, terrain, chapters and stores. It does not add production debug controls.

```sh
npm ci
npm run check
npm run test:e2e -- --project=chromium --project=firefox --project=webkit
npm run test:e2e:mobile
REVIEW_OUT=/absolute/evidence/path node scripts/review-continuous-world.mjs
```

The visual fixture changes camera position to inspect streaming; it is not a claim of manually walking every metre of the world. It visits every scene footprint at all four quality tiers, checks scene caps and unchanged story state, and captures matching fixed views. Bridge movement is checked separately with Rapier. `REVIEW_ROOT`, `REVIEW_BASELINE=1`, `REVIEW_ANGLE=metal|swiftshader` and `REVIEW_PORT` support an immutable baseline comparison. Screenshots are rendered application output, not concept art. The local evidence directory is outside the repository.

The desktop and mobile commands together run the same five-project matrix as `npm run test:e2e`, without repeating the two mobile projects. Both use `CI=1`, one worker, and the repository's existing retry policy.

## Validation results

- `npm ci`: passed with the pinned npm version. The lockfile reported six existing high-severity audit findings; no dependency or lockfile changes were made in this work.
- `npm run check`: passed, including source/mobile contracts, lint, public content QA, application and Cloudflare function type checks, unit tests, seven security tests, production build and Wrangler function compilation.
- Final explicit `npm run test:unit`: **1,378 passed, zero failed**. This includes spatial residency, stable origins, original path preservation, exact terrain/pool agreement, bounded willow geometry, accepted object residence, raised-support grounding and a full bidirectional Rapier bridge traversal.
- Browser scenery review: **128 scene/quality visits passed**, covering all 32 scene footprints at low, medium, high and cinematic settings. Scenery inspection left canonical story state unchanged. Three repeated return loops retained exactly **102 geometries and 17 textures** each. No browser console or page errors were recorded.
- Source comparison: approved archive, canonical narrative definitions, chapter event definitions, journey store and save-state model are unchanged from the baseline. `git diff --check` passes.
- The initial desktop matrix completed with **84 passed, 20 skipped and 55 failed**. All 53 WebKit tests failed before app loading with `Page.overrideSetting: Unknown setting: PushAPIEnabled` (Playwright 1.62.0 selects its older macOS 14 WebKit revision 2251). Two Chromium tests failed: keyboard access after returning to Free Woods, and the second wipe in the opening. These failures remain recorded in the initial report. The Free Woods handoff has since been corrected. Both previously failing Chromium tests pass on the final production build with native Metal (2/2, 24.6 seconds); the opening needed no story-rule changes. No assertions or browser projects were disabled to hide failures.

### Final-build browser qualification

The three available projects ran serially against the same production build with native Metal on macOS. The complete run took 30.2 minutes: **135 passed, 23 skipped, one failed**. Report breakdown:

| Project | Passed | Existing platform skips | Failed |
| --- | ---: | ---: | ---: |
| Desktop Chromium | 48 | 5 | 0 |
| Firefox | 38 | 15 | 0 |
| Mobile Chromium | 49 | 3 | 1 |

The mobile failure was a strict-locator ambiguity in the recovery test, not a failed recovery: the trace shows the route cleared, active entry retained, and `Returned safely to The vision.` announced. Free Woods now also exposes the separate quiet-guidance live region, so `p[role=status]` correctly matched two elements. The test now targets the screen-reader recovery paragraph specifically; its route and active-entry assertions are unchanged. The **entire five-test mobile exploration file then passed (5/5, 18.8 seconds)**, including trusted touch movement/look, portrait/landscape controls, input cancellation and recovery. The whole 159-case suite was not repeated after this test-only selector correction; its initial failure report is preserved alongside the passing rerun.

The 23 skips are existing platform-specific guards, not additions from this branch. Desktop Chromium and Firefox completed without failures. The initial WebKit failures remain an environment qualification gap: this machine's Playwright 1.62.0 macOS 14 override starts WebKit revision 2251, which rejects `PushAPIEnabled` before an app page is created. An isolated mobile-WebKit startup probe reproduced the same `PushAPIEnabled` error while setting up the page (one failed probe, before app loading); the full mobile-WebKit project could not be qualified on this host. No browser implementation or assertion was patched to conceal that incompatibility. No hosted CI run for this branch is claimed; the checked workflows trigger on main or pull requests, not ordinary feature-branch pushes.

## Measured rendering cost — initial streaming checkpoint

Matched fixed views used Chromium on **Apple M1 / ANGLE Metal**, a 1,440 × 900 viewport, DPR 1 and the high quality profile. These are short frame-interval samples from the review fixture, with physics paused and the camera fixed. They are not isolated CPU/GPU timings or long-duration gameplay benchmarks. The baseline was an immutable checkout of `33775918`, using the same fixture and hardware.

| View | Baseline draws / triangles | Updated draws / triangles | Updated median / p95 frame interval |
| --- | ---: | ---: | ---: |
| First woodland | 52 / 293,933 | 102 / 387,761 | 16.7 / 17.6 ms |
| Willow position | 25 / 249,855 | 75 / 312,923 | 16.7 / 17.8 ms |
| Sanctuary approached from wood | 15 / 124,087 | 124 / 186,025 | 16.7 / 17.7 ms |
| Meadow return | 43 / 286,187 | 66 / 292,869 | 16.7 / 17.6 ms |
| Willow, low quality, 390 × 844 | — | 48 / 127,070 | 16.7 / 17.7 ms |

The additional draw calls include real nearby chapters that were absent from the baseline view. This is a content-cost increase, not a draw-call optimization claim. The low-quality portrait capture runs on the same Mac GPU; it does not establish a real phone's frame rate, thermal behavior or memory budget. GPU resource counts are allocation counts, not measured bytes or proof of leak freedom over unlimited play time.

Local before/after PNGs, the generated concept reference and both measurement JSON files are saved outside the repository at `../artifacts/continuous-world-rebuild-20261024/`. The implementation screenshots show the actual procedural result; the concept is clearly separate. Nothing in that evidence directory is bundled into the application.

## Mystical woodland graphics pass — 25 October 2026

- Ground v4 replaces the very dark continuous-forest albedo with mid-value earth, moss and decomposed leaves. Its 376,292-byte WebP fits the existing 400 KB terrain budget; the final-world audit now checks the active file.
- A generated weathered-bark map replaces canvas stripes in the continuous forest and gives the willow trunk and exposed roots real image detail. A 512-square RGBA twig spray replaces diamond leaf silhouettes across the continuous forest, chapter groves and distant crowns. Four vertices and two triangles per card preserve the existing instance and topology budgets. Each material sampler clone is disposed by its owner; loader source images remain shared.
- Warm woodland sunlight, a cool sky fill and blue-green haze provide depth. High and cinematic tiers share one bounded 1024-square shadow map. The outdoor source and target shift together in scene-local coordinates as the camera explores, maintaining the authored light angle. Low/reduced-effects tiers keep shadows off. Domestic light position remains anchored, and the meadow's accepted warming effect remains distinct.
- Free Woods suppresses the already-completed authored arrival handoff, keeping walking and reading controls available on return. The first story playthrough still uses its original transitions.
- Local Chromium E2E rendering selects native Metal on macOS; Linux retains SwiftShader. `PLAYWRIGHT_ANGLE=swiftshader` explicitly restores software rendering for comparison. Full Chromium is also used by the graphics review. The fixture preloads its dependencies to avoid a Rapier initialization race and captures a screenshot on failure.
- Canopy coverage tests now test intersection UVs against a SHA-pinned alpha mask from the compressed runtime image. A card's transparent margin is no longer counted as solid foliage. Original geometry bounds, central air gaps, instance caps and all narrative-state assertions remain checked.


The graphics pass subsequently passed `npm run check` again (1,378 unit tests and seven security tests), followed by a fresh final production build and the updated terrain budget check. Its 128 scene/quality visits passed with no page or console errors; three return loops retained **102 geometries and 25 textures**. Native Metal frame samples at high quality were:

| View | Draws / triangles, including shadows | Median / p95 frame interval |
| --- | ---: | ---: |
| First woodland | 106 / 393,397 | 16.7 / 17.4 ms |
| Willow | 77 / 329,249 | 16.7 / 17.3 ms |
| Sanctuary approached from wood | 129 / 195,325 | 16.7 / 17.5 ms |
| Meadow return | 68 / 310,699 | 16.7 / 17.5 ms |
| Willow, low, 390 × 844 | 48 / 127,070 | 16.7 / 17.8 ms |

One shadow-casting light was recorded at high quality and zero on the low mobile-sized capture. These are short steady-view samples from the development review fixture, not production startup or sustained phone benchmarks. Earlier intermediate captures encountered cold shader/loading stalls and were retained as failed/intermediate evidence; their frame rates are not represented by this final table. The baseline used the prior headless-shell Chromium entry point, so the before/after GPU-work counts are more comparable than an inferred speedup between those browser entry points. Final graphics captures and measurements are in `graphics-final/` within the evidence directory.

This is a material and lighting upgrade to a functioning procedural world. It is not a completed photoreal production-art replacement. At that checkpoint, the screenshots retained angular foreground rocks, sparse distant crowns and a schematic willow silhouette; the following modelling pass addresses those areas.

## Woodland modelling and blue twilight pass — 26 October 2026

This checkpoint adds a split, curved willow bole, asymmetric boughs and attached hanging branchlets; broader tree crowns with smoother high-tier branch curves; and smoothly shaded, irregular stones with a generated weathered-granite albedo. The willow pool and sanctuary banks gain grounded rocks, rushes and textured sediment. Two bounded instance batches add fern/grass colonies outside the actual curved routes. Moss and damp-earth variation enrich the terrain material without changing its height or collision surface. Four mist banks reuse the existing atmospheric shader and clock on high/cinematic tiers.

Outdoor scenes share a blue twilight gradient and one textured blue moon painted into the distant sky, including low/reduced-effects tiers. Local chapter moons are suppressed when the global sky owns the image. Enclosed room lighting is preserved. The warm carried lantern follows the camera. Free Woods explicitly restores that carried presentation after the ending and suppresses its placed copy, while retaining the canonical placed object state and accepted events.

The user-requested checkpoint was committed and pushed as `c20eee2`. The subsequent full `npm run check` passed: 1,384 unit tests, seven security tests, content validation, application and Functions type checks, production build, and local Cloudflare Functions compilation. The first full run exposed an atmosphere test harness that did not provide the newly imported shared moon texture; that harness now supplies the dependency and additionally checks all quality/reduced-effects combinations, indoor/outdoor visibility, and owned-versus-borrowed texture disposal. The existing large-chunk build warning remains; this pass does not claim to reduce bundle size.

The final real-scene review passed all 128 scene/quality visits, three return loops, and the placed-ending → Free Woods lantern transition without page or console errors. It confirms one carried lantern in front of the moving camera, no second placed lantern in Free Woods, and unchanged story state. All three return loops retained **108 geometries and 30 textures**. Resource counts are allocation counts, not measured GPU bytes. Native Chromium/Metal on Apple M1, desktop 1440 × 900 DPR 1 and low portrait 390 × 844 DPR 1, recorded:

| View | Draws / triangles, including shadows | Median / p95 frame interval |
| --- | ---: | ---: |
| First woodland | 112 / 581,989 | 16.7 / 26.2 ms |
| Willow | 84 / 511,097 | 16.8 / 42.5 ms |
| Sanctuary approached from wood | 137 / 308,241 | 16.7 / 17.1 ms |
| Meadow return | 71 / 467,935 | 17.2 / 69.8 ms |
| Blue-moon sky view | 60 / 451,387 | 16.7 / 18.7 ms |
| Willow, low, 390 × 844 | 53 / 198,370 | 16.7 / 17.7 ms |

These short samples include traversal/settling work. The high p95 values at the willow and meadow show remaining frame-time spikes; median values alone are not evidence of consistently smooth 60 fps. An intermediate run was paced near 33.3 ms across all views. A later empty-page rAF control measured 16.7 / 17.6 ms, so the evidence retains both runs without attributing the difference to a proven cause. This is more geometry and texture work than the prior art pass. Low/medium use the original 292-triangle trunk library while high/cinematic use 548 triangles per trunk; instanced floor vegetation remains two bounded draws. No actual phone, thermal or long-duration GPU-memory qualification is claimed.

Production preview health passed at `http://127.0.0.1:4189/`: correct title, meaningful onboarding, Begin → rendered canvas and experience root, no Vite error overlay, and no page errors or console warnings. Browser plugin was unavailable; validation used the repository-pinned Playwright 1.62 Chromium with native Metal. Production interaction QA passed **2/2 desktop tests** (physical opening wipe/reload/inversion/click handoff; completed constellation → dedication → Free Woods/Archive/Constellation) and **5/5 mobile Chromium tests** (handedness, portrait/landscape maps, route recovery, input cancellation, and trusted touch position/look changes). Commands used `PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4189`, `npm run test:e2e`, the corresponding `chromium` / `mobile-chromium` projects, and external artifact output directories. Safari/WebKit remains unqualified because the installed Playwright WebKit runtime previously failed before application startup with `Page.overrideSetting: Unknown setting: PushAPIEnabled`; it was not rerun or represented as passing in this art pass.

Evidence is outside the repository at `../artifacts/woodland-art-pass-20261025/`. Intermediate `v1/`, `v2/`, `final/` and `twilight-v1/` folders are retained as such; `twilight-final/` contains the final qualified twilight captures and measurement JSON. Generated texture provenance and the exact stone prompt are in `public/textures/forest/GENERATED_MATERIALS.md`.

## Remaining production work

- Finish and review the major hero assets: figures, house, bridge, domestic props, tree libraries and destination-specific set dressing. Existing fallback art still appears; this branch does not qualify it as finished production artwork.
- Broaden authored connected geography beyond the willow loop, including a shared river network, terrain-scale hills, distant silhouettes and seamless region transitions. Existing scene anchors and central canonical routes remain largely linear.
- Refine willow bark, canopy silhouettes, shoreline dressing and path edges against the concept reference. Its shape and ecology are implemented, but the rendered result is still a procedural interpretation.
- Move atmospheric transitions toward physical region presence while preserving authored story emphasis and the single lighting authority. Current atmosphere remains driven by the active narrative scene.
- Qualify complete long-duration traversal, all decorative collision envelopes, real touch hardware, thermals, memory pressure and mid-range mobile GPUs. Emulation and a desktop Metal renderer are not substitutes for those devices.
- Review accepted consequences across every chapter in production art. Existing object state projection and canonical memory tests cover durable meaning; some animation playback is transient and may restart when streamed back in.
- Deploy only after an explicit deployment request and final production-art qualification. The user requested a checkpoint push of `codex/continuous-world-rebuild`; this does not deploy or alter remote `main`.
