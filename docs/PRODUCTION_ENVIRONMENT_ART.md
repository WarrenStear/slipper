# Production environment art

This pass develops the existing single-world renderer toward the grounded magical-realism direction. It changes presentation, construction and material response. Canonical prose, choices, progression, authentication, persistence, player movement and terrain sampling retain their existing owners.

## Implemented systems

### Shared authored forms

`environmentArt/authoredGeometry.ts`, `botanicalGeometry.ts` and `npcGeometry.ts` build deterministic timber, worn plaster, padded fabric, plant and animal forms. `EnvironmentArt.tsx` owns their lifetimes and supplies reusable timber, panel and botanical batches. `chapters/ChapterArt.tsx` combines construction pieces into a small number of material draws: joined doors, bridges, wall modules, desks, shelves, windows, upholstered seats and recessed stone basins. Geometry tests check finite attributes, normal/UV coverage, bounds, repeatability and batch budgets.

Hero roses now have overlapping petals and leaves; chairs have joined frames; books have shaped covers and page blocks; candles have softened wax rims and flame silhouettes; nests use a horizontal woven bowl. Swan, Wolf and Phantom use deliberately shaped lightweight fallbacks. Their existing actor cues and story interactions still drive the same scene objects.

### Continuous forest, ground and path

`ContinuousForestBed` remains in `StoryScene.tsx`. Shared tree geometry now includes taper, bend, buttress roots, branch junctions and asymmetric leaf shelves. Worker-selected crown proportions vary tree habits without creating independent tree meshes. The terrain worker adds route/moisture/moss/ash attributes alongside the existing geometry; it does not create another terrain height source or change collision placement.

`ForestSurfaceMaterial` composes the shared tactile shader with broad soil, litter, dampness and moss masks. The physical path has a standard-lit compressed-earth finish with broken leaf edges instead of an unlit amber stripe. Its centerline and sampled ground height use canonical navigation inputs; decorative edge variation leaves the walkable corridor unchanged. Generated path textures and geometries have explicit cleanup.

`ProceduralDome` is incrementally extracted from `StoryScene.tsx`. Soft, warped cloud masses replace visibly regular bands while retaining the existing sky ownership, palette interpolation, quality gates, panorama, depth plate and real moon albedo.

### Surface, water, mirror and light

The original eight tactile finishes are extended with wet wood, charred wood, painted timber, plaster, velvet, ash and moss. All remain standard-lit; the new identities change roughness as well as colour. Low/medium and reduced-effects policies omit micro-relief. Wet timber was specifically retuned after a rendered close-up showed excessive gloss.

`NarrativeWater` is a shared single-pass opaque dielectric surface. Metre-scaled ripple normals, bank darkening, depth-colour variation and a grazing-angle reflected-sky approximation distinguish moonlit still water from directional river flow. It creates no reflection target, second scene render, SSR or transmission pass. The existing `SanctuaryWater` API remains available.

`MirrorMemorySurface` adds view-dependent brightness, edge patina and filtered scratches. Stillness damps disturbance; reduced settings freeze it. `ReflectionDirector` now faces the arriving player, correcting a backing slab that previously hid the symbolic reflection. Joined frames use the same tactile material system. Mirrors remain symbolic rather than live scene reflections.

The existing cinematic hemisphere fill gains restrained earth bounce in enclosed rooms, making edges readable without adding lights. Chapter light motion also respects reduced effects. No new global lighting/atmosphere owner or default shadow pass is introduced.

### Chapter application

| Chapter | Visible changes |
| --- | --- |
| Broken Floor | Worn floorboard edges, plaster and timber construction, more readable room bounce; earned floor reveal remains intact. |
| Enchanted Wood | Shared tree silhouette, physical stepping stones and joined symbolic props. |
| Blue Moon Sanctuary | Joined bridge with worn planks and supports, shaped lily pads/petals, damp timber, single-pass water, restrained glass and fabric. |
| Nest | Shared shelter joinery, fabric, keys, domestic props and nest geometry. |
| Sunset Seer | Arrival-facing aged major mirror, restrained frames and water. |
| Thorned House | Merged wall modules, joined door, curved invasive thorn construction, upholstered bed, rear opening aligned with the existing passage collider. |
| Integration | Authored Wolf/Swan/Phantom silhouettes and shared stone/plant language. |
| Fire/River | Shared authored creatures, directional water, shaped charred botanical forms and existing fire hierarchy. |
| Fork / Three Climbs | Shared timber, stone, botanical and creature forms; their original choices and ascent remain unchanged. |
| Crowned Return | Panelled shelter, rafters, inward-facing window treatment, four-legged writing desk, clothbound books, padded reading seat, recessed basin and rose beds. |
| Epilogue | Shared joined home, desk/books, moving river and recognizable resting creatures; constellation remains derived from witnessed journey state. |

## Quality and accessibility

The existing quality profiles continue to own population, distance, particles, celestial/cloud detail and shadow permission. High/cinematic add tactile relief; low/medium retain broad material identity. Botanical and animal builders use cheaper silhouettes on the base tier. Reduced effects remove secondary water ripples, mirror scratches, nonessential particle detail and light movement; reduced motion freezes water/mirror animation. Mobile uses the same chapter components and world.

The visual change does not take over the camera. Existing cinematography input handoff, stable reduced-motion lens and player control remain tested separately from static art captures.

## Reproducing visual evidence

Use an immutable checkout of the pre-change revision, with the same locked dependencies. `scripts/review-production-art.mjs` renders real chapter components at fixed eye-height cameras, with their authored lighting and atmosphere. It records draw calls, triangles, allocations, light/shadow counts and diagnostic frame samples, and rejects page/console errors and empty renders.

```sh
REVIEW_ROOT=/path/to/baseline REVIEW_PHASE=before REVIEW_OUT=/tmp/slipper-production-art node scripts/review-production-art.mjs
REVIEW_PHASE=after REVIEW_OUT=/tmp/slipper-production-art node scripts/review-production-art.mjs
REVIEW_PHASE=tiers REVIEW_MATRIX=1 REVIEW_CASES=broken,blue,house,crowned REVIEW_VIEWS=arrival REVIEW_OUT=/tmp/slipper-production-art node scripts/review-production-art.mjs
REVIEW_PHASE=details REVIEW_CASES=crowned,finale,reveal,river REVIEW_VIEWS=interior REVIEW_OUT=/tmp/slipper-production-art node scripts/review-production-art.mjs
REVIEW_PHASE=home-mobile REVIEW_MOBILE_ONLY=1 REVIEW_CASES=crowned REVIEW_VIEWS=interior REVIEW_OUT=/tmp/slipper-production-art node scripts/review-production-art.mjs
```

The default pass covers all twelve chapters: arrival/detail/departure at 1100×720 high, plus 393×851 low reduced-effects arrival. The tier matrix adds low, medium, high, cinematic, high reduced-effects and mobile portrait/landscape. These are fixed comparison cameras; Crowned Return's rotated home particularly needs the additional `interior` view, which transforms the camera into its authored orientation. `REVIEW_MOBILE_ONLY=1` captures that selected view in both mobile orientations. `finale` supplies a completed witnessed journey rather than capturing an empty constellation state.

`scripts/review-forest-production.mjs` captures the actual continuous world separately. Chapter fixtures deliberately isolate chapter art; they are not full-world terrain or free-walking evidence. The existing four presentation/woodland/cinematography scripts remain available, now accepting `VISUAL_REVIEW_BASELINE` for repositories without their historical default commits. Their existing draw/light ceilings remain unchanged. Some older scripts reuse current shared dependencies for their baseline copies; use immutable-checkout captures for complete before/after comparisons.

Browser frame samples collected with software WebGL and parallel review processes are diagnostics, not a physical-device frame-rate certification. Draw topology and counts are the useful comparisons from this environment.

## Asset boundary and remaining work

The bundled GLBs remain intentional placeholders; no unlicensed third-party models or large binaries are added. Explicit placeholder metadata selects the authored procedural presentation. The GLB slot clones materials/skeletons per instance, preserves source alpha, and disposes its own resources without disposing cached loader geometry/textures. See `public/models/README.md` for production replacement and decoder requirements.

Final bespoke character modelling and animation, authored bark/leaf texture sets, hardware GPU profiling and a full art-director pass through unassisted walking remain high-value work. This implementation improves the current procedural environment; it does not claim to replace final production modelling or physical mobile-device qualification.
