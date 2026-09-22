# Continuous forest production art

The continuous forest keeps its worker placement, four instanced scenery batches, authored exclusions, fixed collider selection, and canonical 860 m / 128-segment ground. Art changes alter surface response and shared shapes, not the movement graph or terrain heights.

## Shared geometry and hierarchy

`environment/forestGeometry.ts` owns the trunk and canopy builders. A 266-triangle trunk combines a furrowed, tapered bole, rounded buttress roots and rising tapered limbs. Seven offset, flattened leaf masses produce asymmetric crowns; the worker and clearing frame choose slender, spreading or wind-shaped crown proportions from deterministic seeds. Continuous trees still occupy one trunk batch and one crown batch. Existing worker positions, trunk heights, collider arrays and route exclusions remain authoritative.

| Quality | Continuous crown triangles/tree | Clearing crown triangles/tree | Surface response |
| --- | ---: | ---: | --- |
| Low | 140 | 140 | Static broad color/roughness structure |
| Medium | 140 | 560 | Broad structure, fuller nearby silhouettes |
| High | 260 | 560 | Filtered tactile relief; two largest continuous crown masses smoothed |
| Cinematic | 260 | 560 | Same geometry ceiling as High; existing cinematic shadow policy |
| Reduced effects | Selected geometry tier | Selected geometry tier | Base material, no relief or cloud animation; physical structure retained |

The existing `Forms` helper also uses the shared irregular crown and a curved tapered trunk for chapter forest dressing. Roots, trees and crowns remain instanced. The panorama and distant silhouette ring retain their existing background roles and texture budgets; near clearing trees frame the authored landmarks rather than replacing them.

## Ground and the physical path

The terrain worker transfers a four-channel shading attribute alongside its existing positions and colors: route/clearing compression, moisture, moss suitability and ash. This does not participate in height or collision sampling. The extra transfer at the canonical resolution is 266,256 bytes per terrain update, not per frame.

`ForestSurfaceMaterial` composes the existing `applyTactileShader` pipeline. World-scale soil variation breaks texture repetition; compression, moss and moisture influence roughness as well as color. Relief uses the shared screen-space filtering and distance fade. No extra texture downloads, render targets, meshes or lights are allocated for those masks.

`LivingPathRibbon` retains the existing guided physical segment and terrain curve. Its 98 vertices sample the canonical triangulated surface with a 0.027 m offset. A standard-lit earth material, irregular leaf edges and roughness replace the unlit amber stripe. The path adds no particle or motion dependency. Geometry and the generated 128 × 256 texture are disposed when replaced or unmounted.

## Sky and resource ownership

`ProceduralDome` is extracted into its own module and remains the sole existing procedural dome. Irregular cloud strata and restrained edge lighting replace equally spaced sine bands. Low quality omits procedural clouds; Medium uses the short noise path; High/Cinematic add a bounded domain warp. Reduced motion and reduced effects freeze cloud time; reduced effects also removes the cloud detail layer. Renderer color management, lighting, fog, moon albedo and panorama ownership are unchanged.

A startup guard prevents the first render frame from consuming a cell request before the passive effect creates its Worker. The frame callback uses the pure `claimForestBuild` scheduler, whose regression test covers unavailable → ready without camera movement, unchanged-cell deduplication, and pending later cells. No dynamic-code execution or per-frame allocation is used.

Each independently memoized forest geometry has an independent cleanup, including quality changes. No per-tree React components, per-frame texture creation, or per-frame React state are added.

## Validation and reproduction

- `tests/forest-production-art.test.mjs` checks finite deterministic geometry and triangle bounds, compares every generated terrain height with the canonical sampler, and verifies both sides of the physical path follow the triangulated surface through terrain morphs.
- An additional comparison against the frozen baseline covered 18 worker cases across six biomes and three camera cells. Trunk matrices/colors, instance counts, collider arrays, marsh data and ruin data were byte-for-byte identical.
- Existing forest-maze, terrain-model and world-render contracts continue to exercise placement, exclusions, collider distribution and scene ownership.
- The read-only world audit follows the actual extracted forest/dome imports. No check is bypassed with marker comments or disabled requirements.
- `scripts/review-forest-production.mjs` captures the actual continuous terrain worker, forest, path, panorama and dome from fixed cameras. It reads the preserved baseline and freezes a candidate source copy before rendering. Its seven paired configurations cover desktop High/Medium/Cinematic, mobile Low portrait/landscape, and reduced effects. The report records calls, triangles, textures, geometry, programs, instances and exact camera transforms. These software-WebGL captures are visual and render-budget evidence, not real-device FPS certification.

Run with an existing baseline snapshot:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/slipper-playwright \
FOREST_REVIEW_BEFORE=/private/tmp/slipper-art-baseline \
node scripts/review-forest-production.mjs
```

The default output is `/private/tmp/slipper-forest-production-review/report.json` and paired PNGs. The harness does not modify baseline source or production exports. Chapter walkthrough and physical opening tests remain separate evidence for narrative interactions.

### Measured comparison

The final comparison completed all 14 captures across seven matched cases. Every pair has identical camera transforms, instance counts, draw calls, texture counts and light counts; both worker uploads are verified before capture. The isolated comparison uses two non-shadowing lights to keep the source-component comparison controlled.

| Matched case | Before triangles | After triangles | Draw calls | Instances |
| --- | ---: | ---: | ---: | ---: |
| High route, 1100 × 720 | 89,142 | 98,076 | 11 | 206 |
| High clearing, 1100 × 720 | 86,814 | 94,920 | 11 | 194 |
| Medium route, 1100 × 720 | 75,038 | 74,468 | 11 | 150 |
| Low route, 390 × 844 | 60,464 | 55,892 | 10 | 92 |
| Low clearing, 844 × 390 | 58,912 | 54,268 | 10 | 84 |
| Cinematic route, 1100 × 720 | 92,854 | 101,380 | 11 | 214 |
| High route with reduced effects, 390 × 844 | 89,142 | 98,076 | 11 | 206 |

Three baseline captures needed one isolated retry. Their original diagnostics remain in the report: one exposed the existing first-frame worker scheduling race described above; the other two stalled under concurrent software-rendering load. The retry used the unchanged baseline, original camera, and the same worker-readiness gate, and all three passed. Candidate captures passed all seven cases. These observations do not establish frame rates on physical mobile or desktop hardware.
