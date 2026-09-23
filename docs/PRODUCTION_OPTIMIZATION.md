# Production optimization — September 2026

This pass reduces work in the existing authored world. The comparison baseline is
GitHub commit `d933acfe57bc92f08473b39bc7c396c1ef61d55b`.

## Terrain generation

`terrainModel.ts` now provides a prepared point sampler for the worker. It resolves
shape tuning once per request and shares each point's walkable influence between
the canonical height equation and the color/habitat output. The worker reuses one
result object, removing 16,641 duplicate influence calculations per full grid.
The public height sampler, grounding and collision consumers still use the same
canonical equation.

The benchmark used the actual 66 clearings, 65 paths and 129 × 129 vertices on
Node 24.15.0 / Apple M1, with four warmups followed by twelve alternating samples
per implementation and terrain state.

| Exploration depth / memory pressure | Before median | After median | Time saved |
| --- | ---: | ---: | ---: |
| 0 / 0 | 70.4 ms | 51.6 ms | 26.8% |
| 0.3 / 0.2 | 133.9 ms | 80.4 ms | 39.9% |
| 0.95 / 0.85 | 127.9 ms | 78.7 ms | 38.5% |

All nine full-world output arrays were byte-identical. Committed regression
fixtures additionally cover 18 combinations of six biomes, three cells/terrain
states and distinct curve seeds: 11,250 sampled points and 54 worker arrays.
These timings measure CPU terrain generation, not browser or device frame rate.

## Geometry storage and detail

Mixed indexed and non-indexed geometry now merges without expanding the indexed
pieces. Exact attribute indexing preserves positions, normals, UV seams and
normalized attributes. Temporary inputs retain their disposal ownership.
The chair retains all 1,432 triangles while its geometry buffers shrink from
137,472 to 37,584 bytes (72.7%). Warm CPU construction measured 1.69 → 2.11 ms
per chair: exact indexing trades about 0.42 ms at construction for smaller retained
and uploaded buffers. This is not a claim of faster chair construction.

Revolved forms omit only collapsed pole triangles. Their surviving triangle
order and expanded attributes match the baseline. This reduces redundant work
in creatures, candle wax and flames without changing their visible surfaces.

Base-detail plants use fewer samples along leaves and stems while retaining the
same petals, leaves, placement count, material batches and deterministic seeds.
High/cinematic botanical relief geometry is unchanged; reduced effects continues to use
base detail. The live material-quality switch still updates instance transforms
and bounds.

| Base botanical | Before triangles | After triangles | Reduction |
| --- | ---: | ---: | ---: |
| Rose | 536 | 356 | 33.6% |
| Lily | 384 | 288 | 25.0% |
| Reeds | 660 | 460 | 30.3% |

Geometry construction measurements used seven alternating batches of twenty
warm builds and process CPU time; they are separate from rendered frame timings.

## Asset loading

The application no longer preloads legacy linked photographs on every scene
change. Canonical authored scenes and the text journey have no surface displaying
those photographs. The linked visual metadata remains available to orientation
labels; textures used by the forest, moon and materials retain their own loaders.

At the first journey entry, the baseline downloaded three unused JPEGs totaling
246,943 bytes in both the 3D and text routes. Browser request checks cover desktop
and mobile text, the authored 3D opening, and opening restoration.

The initial entry already deferred the 3D engine correctly, so this pass preserves
that loading boundary. No new dependencies or render passes are introduced.

## Validation and rendered comparison

The full `npm run check` passes with 494 unit tests, seven security tests,
content QA, app/Functions typechecks, the final-world audit, production build
and Pages Functions compilation. Terrain and geometry regression fixtures are
recorded against the immutable baseline; they are not generated from the
optimized implementation during the tests.

Twenty-eight matched chapter pairs cover Enchanted Wood, Blue Moon, Thorned
House and Crowned Return at Low/Medium/High/Cinematic, High reduced effects,
and Low/reduced mobile portrait and landscape. All captures completed without
browser or shader errors. Camera transforms, draw calls, lights and texture
counts match the baseline; submitted triangle counts never increase.

| Low-quality detail view | Before triangles | After triangles |
| --- | ---: | ---: |
| Enchanted Wood | 20,252 | 17,012 |
| Blue Moon | 18,708 | 17,472 |
| Thorned House | 16,190 | 15,910 |
| Crowned Return | 12,160 | 10,400 |

These fixed component views isolate the affected geometry; they are not full
world performance measurements. Visual comparison retains the plant silhouettes,
chair surface and chapter composition. Low-detail plants are intentionally less
tessellated; lossless indexing and pole removal retain the baseline's visible
triangle attributes. The existing large Rapier bundle remains unchanged.

Production-browser request checks pass at 1280 × 800 and 393 × 851. Desktop
and mobile text journeys retain zero canvases; the desktop 3D opening mounts
its canvas and required materials. All three routes avoid the three unused
JPEG requests and show no relevant console errors. The Browser skill/plugin
was unavailable, so these checks used the installed Playwright browsers.

The focused E2E run passes five cases with one existing Firefox graphics skip:
accessible scene progression on Chromium, Firefox and mobile Chromium, plus
physical opening gestures, save restoration and input handoff on both Chromium
projects. The tests now also assert that no legacy photo is requested across
the scene transition or opening reload. Assertions and timeouts remain intact.

The live botanical base → relief → base quality-switch check passes for all
five material batches, preserving instance transforms, petal colours and bounds.

CPU benchmarks and software-WebGL captures do not certify physical-device FPS,
thermal performance or total GPU memory. The documented chair construction-time
tradeoff remains; the measured benefits are lower terrain computation, retained
geometry storage, base geometry complexity and unnecessary download volume.
