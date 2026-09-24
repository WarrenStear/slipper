# Final art and environment pass — 24 September 2026

This is a procedural art refinement of the existing renderer. No reviewed production models or material maps were added. The source baseline is remote `main` at `0ae8833132112e868134bc9ad001618e2c107a70`, represented by the clean local snapshot `370f7ae` before this pass. The immutable comparison source is retained in `../artifacts/final-art-mastery/baseline-source`.

## Visible work

| Place or object | Implemented change |
| --- | --- |
| Master lantern | One merged blackened brass housing with a rolled reservoir, burner, separate hood and vent crown, eight open vents, bowed guards, pinned asymmetric bail, fuel cap and wick adjuster. The chimney and contained flame remain separate from the light and external carrying motion. The camera lantern and world prop share the housing. Glass no longer behaves like a glowing solid volume. |
| Key | A bevelled asymmetric bow with a real hole, shouldered barrel and uneven cut ward. Patina is stable vertex colour over the existing material system. |
| Wolf | Authored spine sections distinguish shoulders, chest, tucked waist and hips. Rear legs have a stifle and hock, forelegs remain restrained, and the resting form has extended forepaws, folded hind legs, a curled tail and a grounded body. Eyes sit on the skull; the muzzle shares its coat. No idle animation was added. |
| Swan | Fuller folded wing masses over a tapered waterline, a more deliberate S neck, smaller head and restrained layered feathers. The Blue Moon fallback has a small static waterline wake and sub-centimetre bob driven solely by the canonical water clock. Reduced motion is static. |
| Sunset Seer | A merged frame with three irregular, bevelled profiles and physical depth. Incomplete human contours replace mannequin geometry, including the separate actor mirror used outside the Seer chapter. The live reflected world, scar, hidden route, instruction, mirror-local apparition and semantic anchor remain. Route dots and instruction opacity are quieter. |
| Blue Moon | Thirty-five varied narrow boards replace thirteen broad repeated slabs. Joined bearers, transverse supports, posts, rails and small iron fasteners remain within the authored bridge corridor. Lilies gather along the banks; narrower side curtains leave the central water view open. The original door, Moon, interaction anchors and walkway physics remain. |
| Broken Floor | More plausible board width, staggered end seams, finer filtered grain and softer seams. Room skirting, dado, casing, an old sealed door and handle establish domestic scale. Plaster and the existing SceneLook fill are slightly more readable. The underfloor forest sits deeper, with staggered trunk widths, further depth planes and darker cold illumination around an isolated lantern. |
| Thorned House | Repeated lintels descend further during compression while retaining head clearance and the existing navigation corridor. The opened exit exposes actual exterior space instead of an emissive rectangle. The leaving state retains wall-grown thorns but clears decorative branches across the walking corridor. Existing inward furniture choreography, warm light and collisions are retained. |
| Fork | Let Go contains a clothbound book on worn linen; Depart's cloth hangs from a joined support. The interactive door gains panels, rails, hinge plates and a handle escutcheon. Delete becomes a scraped, fastened timber sign. IDs, event requirements and consequences are unchanged. |
| Mind | More deliberate height progression and uneven narrow slabs preserve controlled repetition. Six large floating regular solids become one merged batch of lower, irregular, grounded outcrops. The separate Three Climbs arrival moves the outcrop group farther away to clear its oblique arrival camera. The existing release removes the near sequence and paper questions, producing an actual opening. |
| Heart | A closer, irregular curved stone and planting enclosure. Worn shallow basins replace cylindrical reward pedestals and their rings. An authored feather replaces the beam diagram; the rose is less oversized. The Moon marking now faces the arrival view. Memory meanings and choice targets remain. |
| Womb | Three broad overlapping earthen shoulders surround a shallow open centre, replacing the radial berm. Sparse low planting and two short cloth supports leave the sky open. Grounded linen, a joined model home and an open book replace floating primitives and voice rings. The recovered key rests on linen, and the blanket hem remains above the ground. Choice and inventory state remain unchanged. |
| Crowned Return | Lower roof and window proportions, a quieter single scarred mirror, a joined reading chair with compressed cushions, a side table and rug, a low child bed with pillow and draped blanket, books seated on shelves with varied heights/depths and spine bands, smaller writing materials, a worn shallow basin and spout, and roses gathered in edge planters. Roof panels meet at a joined ridge, and a matching rear gable closes the former sky gap. The central floor stays open. No crown, reward particles or magical streaks were added. |
| Epilogue | Retains the existing spare remembered route and reverse illumination. No decorative star field was introduced. Shared prop/material refinements carry into its existing composition. |

## Materials and construction

Plaster now combines broad staining with restrained trowel variation. Linen, paper and metal gain broad tonal variation beneath their existing filtered micro detail. Wet timber's fine channels are filtered. Material memory uses an irregular broad wetness field combined with the smaller wear field; scars are localised rather than striped over entire objects. Reintegration still retains scars. Cushion compression and basin wear stay inside their original bounds. Seer water has a local roughness adjustment to soften the distracting grazing highlight identified in the close-up; other water surfaces retain their existing setting.

The continuous forest's rounded shelf geometry retains its original **140 / 560 / 260 triangles** for detail levels 0 / 1 / 2. Small chapter canopy batches use the intermediate contour. Construction remains merged or instanced; no new renderer, composition solver, texture download, per-frame geometry allocation or additional render target was introduced.

Quality selection is unchanged: Low, Medium and reduced effects use the established reflection fallback; High retains at most one 384-pixel hero reflection updated every second frame, and Cinematic at most one 768-pixel reflection, one hero shadow and its existing bounded finishing. No tier acquires an additional render target. The final tier matrix verifies the actual rendered output.

All 13 hero registry entries remain `authored-fallback` with null URLs. All 11 material-map entries remain `procedural-fallback` with empty channels. Replacement validation was not relaxed.

## Surrender

The existing `SceneLook.stillness` flag controls the release. Boundary opacity eases toward 8% of its previous target; the breath field toward 4%. The path ring reduces to 18%, while its central navigation marker remains visible. Particles ease to zero and terminate the imperceptible alpha tail. Existing canonical water, cloth, vegetation, particle and flame clocks still settle; scene silhouettes and navigation remain intact. No saved-state field or completion condition was added.

The first extended lifecycle run caught particulate opacity of 0.00119 immediately after motion stopped. The implementation now ends that invisible residual tail at zero. The failed run is retained alongside the final evidence rather than being represented as a pass.

## Geometry costs

These are complete model triangles, independent of visibility and secondary passes:

| Fallback | Before, base / relief | Final, base / relief |
| --- | ---: | ---: |
| Standing Wolf | 2,168 / 3,016 | 2,028 / 2,600 |
| Resting Wolf | 2,168 / 3,016 | 2,028 / 2,600 |
| Swan | 1,164 / 1,532 | 1,184 / 1,560 |

The six Mind/arrival outcrops form one merged draw containing 600 triangles; they replace six individual 36-triangle solids. The final lantern housing is 2,616 triangles, separate glass 288, key 1,112, Seer frame 408 and apparition 84. All remain single material draws per geometry. The Wolf/Swan keep three material draws; the optional Swan wake is one additional draw. These are geometry counts, not hardware performance measurements.

## Validation and visual evidence

The complete final evidence set contains **218 captures/checkpoints**: 64 Cinematic arrival/detail/interaction/departure views across 16 cases; all 32 canonical scenes at High desktop and Low/reduced portrait (64); 28 quality/mobile comparisons; 8 immutable baseline arrivals; 20 lit/monochrome hero views; 20 lifecycle checkpoints; and 14 continuous-forest comparisons. Evidence lives in `../artifacts/final-art-mastery`; `review.html` is the local gallery and `visual-review-notes.md` records the manual image review. The Browser plugin is not installed, so QA uses the repository's Playwright scripts.

`npm run typecheck`, `npm run test:unit`, `npm run build` and the full `npm run check` passed on the final source: **507 unit tests and 7 security tests**, content validation, TypeScript and Pages Functions compilation. The production dependency audit reports zero known vulnerabilities. The existing large Rapier bundle warning remains. Accessible browser QA passed **6 tests** across Chromium, Firefox and mobile Chromium. The separate Chromium/mobile Chromium interaction matrix passed **14 tests**, with **6 documented project-specific skips**, no failures and no flaky results. The skipped-case reasons are retained in the validation JSON (project-specific touch/keyboard coverage). It covers pointer/touch wipes, reveal persistence, keyboard handling, attention pause/cancel/reload, full semantic progression and relevant mobile navigation.

The 20-case final lifecycle run reported no errors. Repeated quality cycles returned to the same geometry/texture counts. Surrender reached zero particle opacity, retained stable clocks/transforms, and restored environmental activity in the next scene. Every captured scene respected the single-shadow limit and contained no legacy floating-mote layer.

The initial Cinematic pass hit 3 60-second software-renderer readiness timeouts. These records remain in `final-cinematic-initial.json`; corrected and missing cases were captured again in `final-corrections.json`. The harness now accepts an explicit 60–180-second readiness allowance, defaulting to its original 60 seconds. This host used 120 seconds for the final passes. The 61-frame sample, camera, resolution, shadow/reflection rules and error assertions were unchanged. The 32-scene sweep additionally caught an outcrop obscuring the oblique Three Climbs arrival camera. Its arrival-only group was moved five metres back and both desktop and reduced portrait views recaptured; the initial images remain in `final-canonical-before-arrival-fix.json`. The script now accepts an explicit canonical case for isolated recaptures. Source corrections prompted a fresh lifecycle run and affected-scene captures; initial images are not represented as final accepted images.

The following counts include secondary rendering and finishing, at the same camera and tier. They measure submitted work, not frame rate:

| Matched Cinematic arrival | Calls before → final | Triangles before → final |
| --- | ---: | ---: |
| broken | 15 → 15 | 2,866 → 3,886 |
| reveal | 26 → 28 | 11,362 → 23,462 |
| blue | 158 → 164 | 95,702 → 135,158 |
| seer | 116 → 116 | 44,788 → 48,976 |
| house | 103 → 103 | 33,584 → 35,448 |
| river | 64 → 64 | 30,896 → 32,344 |
| womb | 59 → 56 | 19,804 → 25,764 |
| crowned | 125 → 123 | 53,482 → 48,060 |

The complete 28-row tier table and per-view counts are retained in `docs/FINAL_ART_MASTERY_VALIDATION.json`. The continuous forest comparison also checks worker uploads, instance counts, cameras, calls, triangles and lights against the immutable source baseline; all seven matched pairs passed the existing budgets. The initial forest baseline fixture could not resolve `three-stdlib` from its archived directory. Linking that directory to the existing installed dependencies resolved the setup failure; the seven baseline views were rerun with unchanged source and budgets. Initial failures and logs remain in the evidence directory.


The capture method uses actual chapter components, canonical SceneLook, actual actor/object presentation, fixed matched cameras and reduced motion for settled images. Interaction shots seed event consequences; they are visual fixtures, not proof of earning those events. WebGL draw interception includes reflection, shadow and finishing passes. The separate browser journey tests exercise user-facing progression.

Hero inspection is a separate lit/monochrome studio fixture and must not be confused with scene-lighting evidence. The new geometry tests check finite indexed geometry, triangle bounds, actual key/mirror openings and the separate clear lantern chimney. Only the six intentionally changed animal geometry hashes were revised; the other art baselines, collision bounds, budgets and merge/disposal checks remain.

## Reproducing the capture checks

Use the installed Playwright Chromium browser and an absolute `REVIEW_OUT` directory. The final host used `REVIEW_TIMEOUT_MS=120000`; browser installation paths are host-specific. These commands use the checked-in capture scripts:

```sh
REVIEW_PHASE=cinematic REVIEW_CASES=broken,reveal,blue,seer,house,exit,river,verbs,fork,mind,climbs,womb,crowned,sovereign,epilogue,finale REVIEW_VIEWS=arrival,detail,interaction,departure REVIEW_CINEMATIC_ONLY=1 node scripts/review-production-art.mjs
REVIEW_PHASE=canonical REVIEW_ALL_SCENES=1 REVIEW_VIEWS=arrival node scripts/review-production-art.mjs
REVIEW_PHASE=tiers REVIEW_CASES=blue,seer,crowned,river REVIEW_VIEWS=detail REVIEW_MATRIX=1 node scripts/review-production-art.mjs
node scripts/review-hero-art.mjs
node scripts/review-scene-look-lifecycle.mjs
```

For matched source comparisons, set `REVIEW_ROOT` to a separate checkout of the baseline commit and reuse the same case, view and tier. The forest workflow takes that checkout through `FOREST_REVIEW_BEFORE` and writes its report to `FOREST_REVIEW_OUT`. Do not compare different cameras or treat fixture-seeded event consequences as completed gameplay.

## Remaining art and device work

The fallbacks are improved, but this is not photorealistic final asset delivery. Close-up Wolf anatomy, Swan feather transitions, low-tier canopy contours, distant domestic architecture, Three Climbs' abstract arrival markers, Epilogue's miniature remembered places, Heart's stylised Moon and feather, and the mirror's fallback reflected imagery still reveal procedural construction. The Seer water highlight is softer but remains prominent at grazing angles. The chapter terrain is deliberately sparse; it does not replace detailed sculpted ground assets. Studio inspection is not a substitute for licensed, UV-authored production meshes.

Reviewed production assets are still needed for the lantern housing, standing and resting Wolf, Swan, Seer frame/apparition, bridge, key, roses/lilies, desk, chair and fountain. Reviewed KTX2 albedo/normal/roughness/AO maps remain absent for timber, bark, plaster, linen, velvet, stone, earth, ash, metal and paper. The existing registry contracts define scale, axes, origin, ownership and external surfaces for replacement.

Physical Safari/iPhone, Android and integrated-GPU validation remains required, including frame pacing, thermal behaviour, memory after a long journey, shadow quality, grazing-water highlights and touch legibility. Chromium software WebGL submission counts do not certify FPS on physical hardware. The installed WebKit runtime has an existing `Page.overrideSetting: Unknown setting PushAPIEnabled` incompatibility, so it cannot establish Safari coverage on this host.

## Exact files modified

- `docs/FINAL_ART_MASTERY_2026_09_24.md`
- `docs/FINAL_ART_MASTERY_VALIDATION.json`
- `scripts/review-hero-art.mjs`
- `scripts/review-production-art.mjs`
- `scripts/review-scene-look-lifecycle.mjs`
- `src/components/three/MasterPlayerLantern.tsx`
- `src/components/three/artDirection/SceneLookRegistry.ts`
- `src/components/three/chapters/BlueMoonSanctuaryChapter.tsx`
- `src/components/three/chapters/BrokenFloorChapter.tsx`
- `src/components/three/chapters/ChapterArt.tsx`
- `src/components/three/chapters/ChapterPrimitives.tsx`
- `src/components/three/chapters/CrownedReturnChapter.tsx`
- `src/components/three/chapters/ForkChapter.tsx`
- `src/components/three/chapters/ThornedHouseChapter.tsx`
- `src/components/three/chapters/ThreeClimbsChapter.tsx`
- `src/components/three/chapters/chapterArtGeometry.ts`
- `src/components/three/environment/ClimbLandscape.tsx`
- `src/components/three/environment/EnvironmentDressing.tsx`
- `src/components/three/environment/SanctuaryWater.tsx`
- `src/components/three/environment/forestGeometry.ts`
- `src/components/three/environmentArt/AuthoredNpc.tsx`
- `src/components/three/environmentArt/heroGeometry.ts`
- `src/components/three/environmentArt/npcGeometry.ts`
- `src/components/three/reflections/ReflectedPath.tsx`
- `src/components/three/reflections/ReflectionApparition.tsx`
- `src/components/three/reflections/ReflectionDirector.tsx`
- `src/components/three/reflections/UnderfloorForest.tsx`
- `src/components/three/reflections/WaterMemoryReflection.tsx`
- `src/components/three/storyEvents/ObservedSanctuaryReflection.tsx`
- `src/components/three/storyEvents/StoryActorDirector.tsx`
- `src/components/three/storyEvents/StoryObjectModel.tsx`
- `src/components/three/storyEvents/SwanModel.tsx`
- `src/components/three/storyEvents/WetFloorReveal.tsx`
- `src/components/three/storyEvents/tactileShader.ts`
- `src/components/three/world/WorldEngineLayer.tsx`
- `src/components/three/world/WorldEnvironmentParticles.tsx`
- `tests/authored-art-optimization.test.mjs`
- `tests/final-art-geometry.test.mjs`
- `tests/fixtures/authored-art-baseline.json`
- `tests/shot-composition.test.mjs`
- `tests/world-render-contracts.test.mjs`
