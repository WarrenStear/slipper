# Final visual production and renderer integration

This pass strengthens the existing scene-directed renderer. Canonical prose, journey order, object IDs, save schema, player input, camera comfort and accessible text journey remain unchanged. It improves the procedural art and the production-asset adapters; it does not label fallback art as finished production assets.

## One presentation owner

`StoryScene` resolves the authored scene origin, heading and camera guidance. It mounts its world and the children supplied by `StorySceneWithMasterLantern` inside **one** `SceneLookDirector`. Consequently `WorldEngineLayer`, `MasterPlayerLantern`, chapter art, reflections and environmental choreography consume the same context. There is no second copy of resolved scene state.

The registry owns physical palette, source, fill floor, composition, reflection eligibility and budgets. Existing emotional profiles retain emotional camera/audio/movement parameters. The director owns measured/assisted mirror stillness and the mutable vegetation, cloth, water, particle and flame clocks. Consumers do not subscribe React to frame-by-frame motion. All five channels ease to exact zero after surrender; reduced motion/effects stop secondary motion immediately. Leaving that scene restores the next scene's motion targets.

Global guidance, boundary veil, breathing rings, particles and lantern now use those clocks. Lantern sway, flame distortion and the residual placement spring stop with the shared state. Idle flock movement also consumes the scene motion budget; a finite bird-release departure is retained as a narrative action. Mirror reflections consume the director's stillness instead of measuring a competing state. Sunset interaction anchors retain their IDs and gaze/stillness behavior but no longer draw a second small mirror in front of the monumental one. Camera-following, deliberate navigation and essential story transitions remain responsive.

Legacy `worldVisualState` and world/lantern directors still supply geometry, navigation and narrative lamp parameters. They no longer independently own canonical atmosphere or environmental motion. Generic chapter `FloatingMotes` are also suppressed under SceneLook. The old `StoryScene` atmosphere, weather, lighting rig, dome, panorama, mist, motes and whisper layers remain explicitly gated to noncanonical fallback scenes. `LegacyChapterLight` suppresses overlapping chapter fill under SceneLook. The large legacy file is retained incrementally; it has not been rewritten or fully decomposed.

## Renderer and quality limits

| Feature | Low / medium | High | Cinematic | Reduced effects |
| --- | --- | --- | --- | --- |
| Hero secondary view | Existing static/procedural fallback | One 384² target, every second frame | One 768² target, every frame | Disabled |
| Edge smoothing | Existing direct renderer | Single FXAA composite | Up to 4× MSAA beauty | No finishing targets |
| Bloom | Disabled | Disabled | Bright-pass, half and quarter blur scales | Disabled |
| Hero shadows | None | None | At most one 1024² source | None |
| Authored shafts | None | Selected scenes only | Selected scenes only | Disabled |
| Airborne matter | Small tier-scaled scene-specific batch | Small scene-specific batch | Same bounded language | Disabled |
| Material maps | Procedural fallback | Reviewed compact KTX2 eligible | Reviewed compact KTX2 eligible | Procedural fallback |

Finishing targets cap their long edge at 1920 pixels. Cinematic bloom thresholds HDR **before** filtering, clamps highlights, uses four small ping-pong targets and five small passes, then composites half/quarter scales at a maximum 0.14 strength. The four bloom buffers together occupy 0.625 of the full-resolution color-target area. Lantern cores are explicitly HDR; diffuse timber, foliage and fog have no artificial emissive boost. Selection is luminance-based, not an object mask. Devices without float color targets retain byte-color finishing and disable bloom.

Cinematic contact shading remains a restrained eight-neighbor depth approximation, not GTAO. There is no SSR, normal prepass, temporal history or camera jitter. Render target state is restored in `finally`; targets, depth texture, quad and shader resources are disposed on tier changes and unmount.

Scene-specific fill floors replace the universal minimum: 0.055 for Broken Floor, the bedroom and Fire; 0.09 for Blue Moon/Epilogue; 0.32 for Crowned Return; 0.17 elsewhere. The emotional fill may still exceed the floor. Domestic/Fire use a bounded cinematic spot shadow; other scenes use their motivated directional source. The carried lantern cannot add another canonical shadow map.

Shafts are one or two soft, transparent authored volumes in selected Broken Floor, Enchanted Wood, house-exit and Crowned scenes. They depth-test against geometry, but do not sample a scene depth texture for soft intersection fading. Sky structure adds faint cloud luminance, source glow and horizon haze to the existing gradient; its movement consumes the shared clock.

## Environment and object work

| Place | Changes |
| --- | --- |
| Broken Floor | More varied and deeper underfloor trunks, offset crowns, near branches, smaller distant lantern and local cold/warm separation. Damp stains break up the timber response. Existing wipe mask, discovery stages and camera-dependent parallax remain. |
| Enchanted Wood / Nest | Sparse pollen or warm dust replaces generic sparkles. Selected canopy shafts retain the forest/clearing hierarchy. |
| Blue Moon | Grazing-angle water reflection, narrower plank gaps, reviewed bridge/lily adapters, sparse moisture and retained black water, cloth, Swan and secondary candle light. |
| Sunset Seer | Shared stillness sharpens the real reflection; quieter narrative overlays, a softer silhouette apparition, arched frame profile, patina and additional fine crack branches. |
| Thorned House | Overhead crosspieces lower and furniture moves inward during compression. Self-permission resets compression and exposes outside light without a victory effect. |
| Fire / River | Ash/spray profiles replace sparkles, Fire gains one motivated shadow, and surrender settles all shared environmental clocks and global layers. |
| Fork | Folded linen and worn timber markers replace the release/delete primitives; a warded, bevelled key and improved shared furniture retain interaction IDs. |
| Mind / Heart / Womb | Longer angular repetition opens after Mind release; Heart's curved personal enclosure remains. Womb gains a shallow soft-earth bowl, sparse planting, a wider low shelter and less hard path geometry. |
| Crowned Return | Staggered boards, skirting/dado joinery, desk boards/drawers/pulls and cloth-bound book, quieter textiles, linen child space, botanical/furniture adapters and a non-glowing fountain. The unused space stays empty. Crown stays mirror-only. |
| Epilogue | Global WorldEngine decoration is suppressed; the existing remembered-route reverse light remains the narrative image. |

The lantern housing and key are merged authored meshes with bounded vertices and finite bounds. The Sunset apparition is a single softened silhouette rather than stacked body primitives. Wolf/resting Wolf and Swan retain the previous authored fallback bodies; this pass preserves those and their reviewed-model adapters, rather than claiming new rigged animal art.

## Production assets and material memory

`HeroAssetSlot` now wraps the master lantern housing, cracked mirror frame, moon bridge, key, writing desk, reading chair, fountain basins and representative roses/lilies in real chapter/runtime usage. Story interaction, flame, glass, water, papers and relevant placements remain outside replacement models. Asset-only transforms preserve existing procedural fallback coordinates. The registry requires explicit `reviewed-production` status and local `/art/heroes/` sources; placeholder GLBs remain ineligible.

Wetness now adds localized damp albedo and roughness variation; wear adds restrained fading; damage adds filtered dark scars. Reintegration reduces roughness inconsistency while preserving damage. Shared memory uniforms update without a shader variant per history. A zero-memory shader avoids the extra memory-noise evaluation.

The material registry covers timber, bark, plaster, linen, velvet, stone, earth, ash, metal/brass, paper and wood/frame materials. Automatic loading requires reviewed local KTX2 channels, maximum 1024-pixel dimensions and bounded repeat values. Actual decoded dimensions are checked as well. Albedo is sRGB; data maps remain non-color. Sources are shared per renderer; each consumer owns its texture-transform clones. The last consumer releases cached textures and the two-worker transcoder pool. Partial failures and unmounts retain the procedural fallback and prevent late orphan clones.

**No reviewed production models or authored material maps were supplied.** All registry defaults remain procedural fallbacks, and no new texture library is downloaded. Asset-specific visual approval and a successful real KTX2 upload/transcode still need the actual art; current tests verify admission policy and fallback behavior.

## Verification method

The Browser plugin was unavailable, so the repository's Playwright/Chromium workflow was used. Chapter captures mount the real chapter components, canonical actor-state adapter, actual story-object director with fixture input disabled, environmental choreography and global layers under SceneLook. Lantern ownership, bird release and origami state use the runtime actor adapter, avoiding duplicate guide actors or a carried lantern after placement. They inspect arrival, hero detail, seeded interaction consequences and departure. Every canonical scene can be selected with `REVIEW_ALL_SCENES=1`; mobile captures check reduced-effects readability. These fixtures are distinct from the real-input opening and accessible/cinematic gameplay tests.

The lifecycle runner includes the actual `StorySceneWithMasterLantern` runtime, not only isolated chapter fixtures. Its probe samples after all frame subscribers. It checks one presentation authority, upper-tier reflection sizes, zero reduced-effects targets/particles/shafts, bounded shadows, bloom allocation, repeated tier disposal, stable camera and exact held-zero global motion, resumption after departure, and unmount/remount.

Captured draw counts include secondary views, shadows and finishing through WebGL interception. DPR is 1 and Chromium uses software WebGL. Measurements verify topology and regression budgets; they do not certify hardware FPS or compare fairly with earlier fixtures that omitted global layers.

```sh
npm run check
REVIEW_PHASE=final REVIEW_CASES=broken,wood,blue,nest,seer,house,integration,fire,river,fork,mind,climbs,womb,crowned,epilogue,reveal,finale REVIEW_VIEWS=arrival,detail,interaction,departure node scripts/review-production-art.mjs
REVIEW_PHASE=focus REVIEW_CASES=verbs,exit,sovereign REVIEW_VIEWS=arrival,detail,interaction node scripts/review-production-art.mjs
REVIEW_PHASE=canonical REVIEW_ALL_SCENES=1 REVIEW_VIEWS=arrival node scripts/review-production-art.mjs
node scripts/review-scene-look-lifecycle.mjs
```

Use `REVIEW_OUT`, `REVIEW_PORT`, `REVIEW_CINEMATIC_ONLY=1` and `PLAYWRIGHT_BROWSERS_PATH` where required. Start a production preview for the separate `e2e/opening-sequence.spec.ts`, `e2e/accessible-journey.spec.ts` and `e2e/cinematic-story-gameplay.spec.ts` tests. `PLAYWRIGHT_OPENING_QUALITY=cinematic PLAYWRIGHT_OPENING_FULL_EFFECTS=1` explicitly enables the full cinematic opening path despite browser reduced-motion defaults.

## Remaining limits

Broad tree crowns, some domestic props, the older framed Seer representation outside Sunset, and animal poses still expose procedural construction. Some secondary story props still need placement consolidation with chapter scenery; the house exit retains its simplified luminous backdrop. Bespoke reviewed hero models, rigged transitions and compact authored maps remain the largest art gap. Shafts have geometric depth testing, not soft depth intersections; bloom has a luminance threshold, not object masking; screen-depth contacts are approximate. Reflection-specific geometry LOD, true volumetric fog and indirect illumination remain out of scope. Native pointer-lock comfort, hardware/mobile GPU timing and close-up artistic approval require physical-device review.

## Final validation results

- `npm run check` passed, including **503 unit tests**, **7 security tests**, content/integration/lint validation, application and Pages-function TypeScript, production build and Pages function compilation.
- **12 desktop/mobile Chromium journey tests** and **2 full-effects Cinematic opening tests** passed. They cover physical pointer/touch wiping, input handoff, earned-save restoration, complete accessible scene progression, choices, lantern placement and ending persistence.
- **20 rendering lifecycle cases** passed with no browser errors. The actual runtime has one scene authority, holds exact-zero global motion, preserves an empty semantic Seer interaction anchor beneath the single monumental mirror, and disables costly effects when requested. Three Cinematic → Low cycles returned to identical geometry/texture counts: `[{'geometries': 35, 'textures': 3}, {'geometries': 35, 'textures': 3}, {'geometries': 35, 'textures': 3}]`.
- **115 chapter/scene images** completed without browser errors: 85 main views, 18 Cinematic hero views, and 12 focused Four Verbs / self-owned house exit / sovereign-return views. Captures assert no legacy mote layer and at most one shadow source. Every canonical chapter is represented.
- Source whitespace checks passed. The pre-existing large Rapier/WASM bundle warning remains; this pass adds no model or texture downloads.

The machine-readable [validation record](FINAL_VISUAL_PRODUCTION_VALIDATION.json) includes capture parameters, renderer counts and lifecycle state. Full PNGs, CSV metrics, browser reports and the filterable gallery are saved in the task workspace's `artifacts/final-visual-production/` directory. The final capture fixture uses actual actor/object presentation; older images produced while correcting its duplicate objects are superseded.
