# Scene-directed world presentation

This records the earlier architecture pass. For the subsequent global-layer integration, high-tier FXAA, multiscale bloom, expanded asset adapters and final production validation, see [Final visual production](FINAL_VISUAL_PRODUCTION.md).

This implementation follows `STORY_VISUAL_BIBLE.md`, `EMOTIONAL_CINEMATOGRAPHY_BIBLE.md`, `CINEMATIC_LIVED_STORY.md` and the existing journey architecture. It changes presentation, not canonical prose, scene order, saved story facts or interaction requirements. It is an implemented renderer upgrade, not a claim that the procedural fallback art is final production art.

## Ownership

`artDirection/SceneLookRegistry.ts` explicitly covers all 32 canonical scenes. Each entry identifies one hero image, its focal point, lighting source, palette, openness, material weathering and eligible reflection. Emotional camera, movement and audio parameters are still resolved by `emotionalProfiles.ts`; they are not copied into a second emotional profile table.

`SceneLookDirector` resolves story consequences and measured/assisted stillness into one presentation context. It advances mutable motion clocks before consumers without a React render per animation frame. Context identity changes for real scene/settings/story changes, so declarative quality gates and materials update as well as frame callbacks. Stillness reads player position inside the frame loop instead of subscribing the whole presentation tree to every movement update.

The director owns:

- `SceneLighting`: one scene-anchored motivated key and a low hemisphere fill; practical lamps and flames remain in their authored locations.
- `SceneAtmosphere`: background, gradient sky and exponential fog, with cleanup that restores only resources it still owns.
- `ScenePostProcessing`: Cinematic finishing, gated off for reduced effects.
- The existing `CinematicCameraDirector`: input priority, stable horizon, assistance preference and reduced-motion behavior remain intact.

Canonical scenes no longer mount the older atmosphere, lighting rig, sky dome, panorama, geometry vignette, generic weather, path motes, path mist or whisper decoration. `LegacyChapterLight` prevents chapter fill rigs from accumulating under the new director. These systems remain available to legacy/isolated compositions. `worldVisualState` derives canonical palette/openness from the same scene registry for the worker-built environment. `CanvasRendererController` yields exposure while a cinematic presentation owner is active.

`StoryScene` remains the world/player/progression orchestrator. Its old frame overlay moved to `artDirection/LegacyFrameOverlay.tsx`; new presentation responsibilities live outside it. This is a deliberate incremental extraction, not a completed decomposition of the large legacy file.

## Rendering budget

| Tier | Hero capture | Finishing | Fallback |
| --- | --- | --- | --- |
| Low | None | None | Existing symbolic water, glass and forest image |
| Medium | None | None | Existing lit water and aged mirror skin |
| High | 384 × 384, every second frame | None | Same physical landmarks |
| Cinematic | 768 × 768, every frame | One bounded beauty target and finishing triangle | Same physical landmarks |
| Reduced effects, any tier | None | None | Static readable narrative surfaces |

Only Broken Floor, Blue Moon water and the Sunset Seer mirror are eligible. Planar surfaces reject recursive captures and distant cameras, and cap the reflection camera far plane at 64 units. Geometry/material/target ownership is explicit and disposed on unmount or quality changes. The underfloor volume is a separate small instanced scene rendered from the actual camera and projectively sampled through the existing wipe mask. It therefore supports translation parallax instead of moving a photograph. Lower tiers retain the original image fallback and identical wipe interaction.

Cinematic uses a maximum 1920-pixel long edge, up to four MSAA samples, depth texture, bounded local depth-contact shading, HDR bright-pass bloom, scene contrast/saturation, a small vignette and static sub-code-value dither. The contact shading is a modest depth-neighbor approximation, **not GTAO**. Bloom is luminance-thresholded, **not an object-selection mask**. There is no global SSR, temporal accumulation, depth-of-field blur or extra normal prepass. Devices without float color targets use an unsigned-byte target and disable HDR bloom. Hardware performance still needs device profiling; software WebGL captures do not certify real-device frame rates.

## Chapter changes

| Chapter | Implemented presentation |
| --- | --- |
| Broken Floor | Cold motivated light, wet timber shader, restrained ordinary room, lantern appears after discovery, camera-dependent instanced forest below the wiped surface. Existing staged room dissolution and pointer ownership remain. |
| Enchanted Wood | Scene-specific canopy light and cool shadow, shared damp material state, lower particle intensity and removal of overlapping generic effects. Existing layered forest, flowers and cue-driven actors remain. |
| Blue Moon | Explicit world-sized hero moon, almost-black planar water on upper tiers, retained weathered bridge/cloth/lilies and candle choreography. |
| Nest | Separate dawn/pressure/protection scene looks; existing burden-dependent framing, child space and occupied-hand behavior remain. |
| Sunset Seer | One monumental mirror, live bounded reflected landscape, retained crack and mirror-local narrative imagery; competing side mirrors and light strip removed. Measured or assisted stillness settles water/cloth/particles and sharpens the mirror. |
| Thorned House | Domestic practical key replaces competing global fills; existing progressive room/furniture compression, traversable path and exit restoration remain. |
| Integration | Continuous stone/reed shoreline brings woodland and water together; glowing completion nodes become physical stones and the extra reward light is removed. |
| Fire / River | Both routes stay present. Fire supplies the motivated key in its scene; river light comes from the sky. Shared clocks reduce cloth, ripples, ash, motes and flame instability to zero after surrender; carried lantern steadies. |
| Fork | Familiar path loops into a low enclosing canopy and domestic house; the other path narrows through sparse grass into an unseen horizon. Natural overgrowth replaces cones, and luminous future markers are removed. Existing choice and ownership state is preserved. |
| Three Climbs | Mind has repeating angular vertical boundaries that open on release; Heart has a curved planted enclosure; creation has a low, wide protected earth boundary. Existing object choices remain in their original interaction locations. |
| Crowned Return | Morning scene light, actual openings around the two windows, translucent glazing, inherited aged materials; existing authored desk/books/upholstery/basin/roses remain. Crown remains mirror-only. |
| Epilogue | Restrained scene light and no canonical decorative star layer. Existing reverse illumination uses actual visited journey geography and retains its completion/persistence contract. |

## Materials and hero art

`TactileMaterial` keeps its analytic surface identity and adds bounded wetness/damage/reintegration inputs. It accepts borrowed albedo, normal, roughness and AO texture maps, including KTX2 textures from the existing loader. It does not dispose shared texture-cache resources. `materials/materialLibrary.ts` provides compact presets and pure weathering resolution. No large texture downloads were introduced.

`actors/heroAssetRegistry.ts` records reviewed-production eligibility and coordinate contracts for the lantern, Wolf/its resting pose, Swan, mirror apparition, frame, bridge, key, flowers and home furniture. The canonical Wolf and Swan use `HeroAssetSlot`, with Suspense, load-error and placeholder-metadata fallbacks. Other entries document the adapter contract for final art; they are not all wired to automatic replacement yet. Existing `/models/*.glb` placeholders are deliberately ineligible. A final model must be explicitly reviewed and placed under `/art/heroes/` before it can replace an authored fallback. Model materials/skeletons are cloned and disposed independently; cached geometry/textures remain shared.

## Verification and limits

The Browser plugin is not available in this environment; the existing Playwright infrastructure is used. `review-production-art.mjs` mounts the real chapter components, canonical scene director, actors and environmental choreography. It captures arrival, hero detail, interaction consequence and departure, plus mobile arrival. Interaction fixtures seed documented event consequences; they do not substitute for the separate real-control end-to-end tests. Home cameras now face the actual authored doorway instead of a side wall. Draw instrumentation counts WebGL calls across primary views, secondary views, shadows and finishing, rather than only the most recently rendered pass.

The earlier baseline fixture supplied extra fill lights and omitted actors/choreography. Its images are useful historical evidence, but its draw counts and lighting are not a controlled performance comparison to the corrected fixture. Treat candidate measurements as topology checks, not a claimed speedup.

Remaining art work includes bespoke rigged Wolf/Swan poses and transitions, a subtler reflected human figure, a unified lantern model, close-up bridge/wood joinery, a high-quality key, sculpted furniture and botanical silhouettes, and authored compressed material maps. Broad crowns, some domestic props and reflection apparitions still reveal procedural construction. Height-dependent volumetric mist, physically accurate indirect lighting, reflection-specific LOD and object-masked bloom are not implemented. Scene composition fields partly guide authored geometry/palette; they are not a general automatic composition solver. Final art quality requires those assets and hardware/mobile GPU profiling, plus an artistic review of the complete continuous world.

## Repeating the checks

```sh
npm run check
REVIEW_PHASE=candidate REVIEW_VIEWS=arrival,detail,interaction,departure node scripts/review-production-art.mjs
node scripts/review-scene-look-lifecycle.mjs
PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4331 npx playwright test e2e/opening-sequence.spec.ts e2e/accessible-journey.spec.ts e2e/cinematic-story-gameplay.spec.ts --project=chromium --project=mobile-chromium
PLAYWRIGHT_OPENING_QUALITY=cinematic PLAYWRIGHT_TEST_BASE_URL=http://127.0.0.1:4331 npx playwright test e2e/opening-sequence.spec.ts --project=chromium
```

Start the production preview on the selected URL for the end-to-end commands. Install the configured Playwright Chromium first; `PLAYWRIGHT_BROWSERS_PATH` can select an existing browser cache. Both art scripts create isolated preview fixtures and accept `REVIEW_OUT` and `REVIEW_PORT`. `REVIEW_CASES` and `REVIEW_CINEMATIC_ONLY=1` support focused chapter recaptures.

The lifecycle regression keeps the same canvas through floor, Seer, Blue Moon and surrender; checks all four quality tiers, reduced effects, camera translation, settled motion, repeated quality changes and unmount/remount. It caught and fixed a real R3F primitive cleanup failure: `dispose={null}` overwrote the Reflector instance method, so cleanup now retains its bound original disposer before mounting.

## Validation recorded for this change

- `npm run check` passed: content/integration validation, lint, application and Pages-function TypeScript, 499 unit tests, 7 security tests, production Vite build and Pages function compilation. TypeScript, all 499 unit tests and the production build were repeated after the final shared-clock and slow-frame reveal changes. The existing large Rapier/WASM bundle warning remains.
- Twelve desktop/mobile Chromium journey tests passed. They exercise physical pointer/touch wipes, earned-save restoration and input handoff, plus full 32-scene accessible journeys with carried objects, Heart/Womb choices, lantern placement, reverse-light ordering and ending persistence. Full-story semantic coverage is not a claim that every scene was physically traversed in WebGL.
- Sixty historical baseline and sixty candidate chapter captures completed without browser errors. Candidate views cover arrival, detail, interaction consequences and departure for twelve chapters, plus reduced-effects mobile arrivals.
- The final 13-case rendering lifecycle passed with no browser errors. Three Cinematic → Low cycles each returned to 24 geometries and 3 textures. Reduced effects removed live hero capture; measured camera translation retained the underfloor target; assisted mirror stillness and surrender reached zero shared environmental motion; the camera stayed unchanged during surrender; unmount/remount produced a fresh context and clock.

The full-effects opening run explicitly checks both the saved quality preference and the document's effects mode. Merely selecting `?quality=cinematic` is insufficient evidence: the app deliberately defaults reduced effects on when the browser requests reduced motion. The Cinematic chapter fixture also enables shadow rendering, not only `castShadow` on the light.

The full-effects opening regression also caught a slow-GPU reveal freeze. `WetFloorReveal` previously dropped animation deltas above 250 ms, allowing an earned wipe to remain visually at the previous stage indefinitely. It now advances with a bounded 100 ms step, retaining hidden-page, focus, drawer and exploration guards. This changes presentation catch-up only; it does not award a wipe or advance story state.

The two full-effects Cinematic opening tests passed after that fix. Six final Cinematic captures (revealed floor, Blue Moon, Seer, Mind, creation and completed epilogue) also passed with shadows enabled and no browser errors. Together with the earlier chapter matrix this is 66 candidate chapter captures. These are software-rendered composition and rendering-path checks; native pointer-lock behavior and hardware frame-rate certification remain manual/device QA.
