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

All new runtime geometry is authored in repository code using the existing Three.js geometry helpers. It adds no remotely hosted media, model downloads, package dependencies, texture files or third-party asset licence obligations. The generated willow concept is a local visual reference only, not a runtime skybox or a replacement for original imagery. Existing production-asset admission and placeholder declarations remain unchanged.

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
- At this checkpoint the desktop end-to-end matrix is still running; the mobile matrix follows. Final counts will be recorded after those runs complete. The results above do not imply that the complete browser matrix has already passed.

## Measured rendering cost

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

## Remaining production work

- Finish and review the major hero assets: figures, house, bridge, domestic props, tree libraries and destination-specific set dressing. Existing fallback art still appears; this branch does not qualify it as finished production artwork.
- Broaden authored connected geography beyond the willow loop, including a shared river network, terrain-scale hills, distant silhouettes and seamless region transitions. Existing scene anchors and central canonical routes remain largely linear.
- Refine willow bark, canopy silhouettes, shoreline dressing and path edges against the concept reference. Its shape and ecology are implemented, but the rendered result is still a procedural interpretation.
- Move atmospheric transitions toward physical region presence while preserving authored story emphasis and the single lighting authority. Current atmosphere remains driven by the active narrative scene.
- Qualify complete long-duration traversal, all decorative collision envelopes, real touch hardware, thermals, memory pressure and mid-range mobile GPUs. Emulation and a desktop Metal renderer are not substitutes for those devices.
- Review accepted consequences across every chapter in production art. Existing object state projection and canonical memory tests cover durable meaning; some animation playback is transient and may restart when streamed back in.
- Deploy only after an explicit deployment request and final production-art qualification. The user requested a checkpoint push of `codex/continuous-world-rebuild`; this does not deploy or alter remote `main`.
