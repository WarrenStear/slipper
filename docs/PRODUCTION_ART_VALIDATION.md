# Production art validation

This record covers the production-art implementation and the completed evidence available on 22 September 2026. The reference runtime is remote revision `a303e30`, preserved locally as immutable baseline `de8ce71`. The full chapter comparison reads `/private/tmp/slipper-art-baseline` and the frozen candidate `/private/tmp/slipper-art-final-source`; it does not substitute current shared components into the baseline.

The rendering, quality-matrix, full repository checks and applicable browser cases below passed. The browser record explicitly retains the original WebKit host incompatibility and sleep-interrupted mobile run, along with the unchanged successful reruns.

## Completed evidence

| Evidence | Recorded result | Scope |
| --- | --- | --- |
| Twelve-chapter immutable comparison | 48 baseline captures and 48 matching final captures; zero recorded failures in either report | Actual chapter components, identical scene IDs and camera positions |
| Continuous forest comparison | Seven matched pairs / 14 captures; zero final failures | Actual forest and terrain workers, physical path, panorama and dome |
| Existing visual-presentation review | 13 captures; zero failures | Production entry controls, props, wet floor and selected chapter fixtures |
| Existing environment review | 19 captures; zero failures | Broken Floor, Blue Moon and Thorned House fixtures, desktop/mobile entry |
| Existing cinematography review | 26 captures and one camera-interaction group; zero failures | Matched scene/camera comparisons and actual camera/input lifecycle |
| Existing woodland review | 17 captures; zero failures | Meadow, rabbit meadow, seeded ending and entry controls |
| Expanded chapter quality matrix | 28 captures; zero failures | Four chapters × seven quality/viewport/reduced-effects configurations |
| Supplementary chapter comparison | Eight paired views; zero failures | Home interior, completed witnessed epilogue, floor reveal and river surrender |
| Mobile home interior | Two paired views; zero failures | Low/reduced portrait and landscape in the home’s authored orientation |
| Botanical live quality regression | Passed | Medium → High → Medium preserves matrices, colours and bounds across five botanical batches |
| Applicable browser matrix | 23 passed, 27 existing skips | Chromium, Firefox, mobile Chromium; supplemental compatible desktop/mobile WebKit. Original environment failures retained below. |
| Full `npm run check` | Passed; 487 unit tests and seven dedicated security tests, all passing | Source validation/lint, 66-entry content QA, app/Functions typechecks, tests, production build and Wrangler Functions compilation |

The four existing review suites retain their draw-call, light and shadow thresholds. Harness changes provide a selectable baseline, separate temporary fixture names and isolated Vite caches; they do not relax the assertions.

The full check also completed the read-only final-world visual/performance audit. The build still emits its large-chunk warning, including the approximately 2.06 MB uncompressed Rapier WASM chunk; this pass does not claim to remove that existing delivery cost.

## Twelve chapters at the same cameras

Each chapter has four matched configurations: arrival, detail and departure at 1100 × 720 / High, and arrival at 393 × 851 / Low with reduced settings. The reports contain all 48 pairings, with no camera-position, light-count or texture-count changes between corresponding captures. All recorded chapter shadow counts are zero. Each capture waits 25 warm-up frames and records 36 frame samples at DPR 1.

The compact comparison below uses the desktop High arrival view for each chapter. Calls and triangles are the renderer's submitted counts for that particular view, including culling; they are not whole-game totals.

| Chapter / captured scene | Draw calls, before → final | Triangles, before → final |
| --- | ---: | ---: |
| Broken Floor / `broken-floor.confession` | 16 → 16 | 1,428 → 2,580 |
| Enchanted Wood / `enchanted.friendship-meadow` | 34 → 23 | 14,408 → 30,988 |
| Blue Moon / `blue-moon.intimacy` | 76 → 40 | 18,980 → 31,728 |
| Nest / `nest.protection` | 40 → 39 | 8,096 → 22,146 |
| Sunset Seer / `sunset.true-mirror` | 51 → 56 | 7,308 → 22,480 |
| Thorned House / `thorned.old-memory-bedroom` | 91 → 50 | 3,844 → 18,996 |
| Integration / `wolf-swan.convergence` | 18 → 19 | 5,126 → 16,706 |
| Fire and River / `fire.boundary` | 74 → 52 | 16,434 → 22,790 |
| Fork / `fork.weighing` | 24 → 11 | 4,086 → 15,510 |
| Three Climbs / `climb.heart` | 56 → 42 | 6,408 → 4,148 |
| Crowned Return / `crowned.home` | 45 → 32 | 4,512 → 22,080 |
| Epilogue / `epilogue.constellation` | 149 → 122 | 14,991 → 24,895 |

The extra triangles buy worn edges, curved plants and creatures, joined furniture, architectural detail and less regular forest silhouettes. Merging and instancing reduce calls in most sampled chapters, but the Seer adds five calls and Integration adds one. Neither the geometry increases nor those two call increases should be described as a universal performance improvement. Their practical cost requires hardware profiling.

The Crowned Return row includes four recaptured views after the final window-glass depth correction. The supplementary interior comparison decreases from 71 to 51 draw calls while adding construction detail (4,856 to 28,502 triangles). The default epilogue fixture is appearance evidence for its recorded state; it does not demonstrate earning the complete constellation through play.

## Continuous forest comparison

All seven final pairs use identical camera transforms, instance counts, texture counts, draw calls and light counts. Both the forest upload and canonical terrain upload are verified before capture, with at least 35 rendered frames and three consecutive ready frames. The isolated fixture uses two non-shadowing lights.

| Matched configuration | Draw calls, before → after | Triangles, before → after |
| --- | ---: | ---: |
| High route, 1100 × 720 | 11 → 11 | 89,142 → 98,076 |
| High clearing, 1100 × 720 | 11 → 11 | 86,814 → 94,920 |
| Medium route, 1100 × 720 | 11 → 11 | 75,038 → 74,468 |
| Low route, 390 × 844 | 10 → 10 | 60,464 → 55,892 |
| Low clearing, 844 × 390 | 10 → 10 | 58,912 → 54,268 |
| Cinematic route, 1100 × 720 | 11 → 11 | 92,854 → 101,380 |
| High route, reduced effects, 390 × 844 | 11 → 11 | 89,142 → 98,076 |

The report preserves three earlier baseline failures in `priorFailures`. One exposed the original worker-startup race: terrain completed but no forest build was posted over 3,012 observed frames. The other two stalled under concurrent software-rendering load. One isolated retry of those three cases used unchanged baseline source and the original readiness gate; all passed. All seven candidate cases passed. The production fix for the worker-startup race has a separate scheduler regression test.

## What the evidence supports

The change replaces prominent primitive silhouettes with deterministic authored forms while preserving the existing story and interaction owners. The clearest construction work is visible in Broken Floor's worn boards and plaster, Blue Moon's joined bridge and lilies, Thorned House's framed rooms and curved thorns, and Crowned Return's rafters, desk, books, upholstered seating and recessed basin. Other chapters inherit the same timber, stone, botanical, candle and creature vocabulary. Meadow flowers now use petals and leaves while retaining two material batches.

The continuous forest retains instanced scenery and canonical worker placement while adding tapered trunks, branch junctions, buttress roots and asymmetric crowns. Ground and path materials distinguish litter, moisture, compression and moss without introducing another terrain-height source. Low and Medium continuous-forest triangle counts are lower in the matched route samples.

Water is a single-pass opaque surface with metre-scaled ripples and a reflected-sky approximation. River flow differs from still water. Mirrors gain aged frames, patina and view-dependent response; the major Seer mirror faces the authored arrival. Room fill improves construction readability through existing lights. The capture records show no added light or texture allocations in matched chapter/forest views and no new shadow pass in these fixtures.

Geometry tests exercise determinism, finite attributes, normals/UVs, authored bounds, batching and quality ceilings. Existing collision, route, narrative and persistence contracts remain in the full check. These tests support the implementation boundaries; rendered captures remain necessary for composition and material assessment.

The camera interaction review records bounded idle settling, no camera translation, pointer/wheel/held-input handoff, Settings freezing the camera, and a stable 65-degree reduced-motion lens. This is separate from the static chapter captures.

## Interpretation and limitations

- These are real components in controlled fixtures. Chapter fixtures isolate chapter art and omit the complete continuous world. The forest fixture exercises the continuous world separately. Neither is an unassisted walkthrough of the entire story.
- The visual, environment and woodland legacy harnesses copy selected historical entry components but retain some candidate shared helpers. Their baseline figures can therefore include the new toolkit; equal prop or meadow counts do not mean those forms were unchanged. The immutable twelve-chapter comparison is the stronger complete-art comparison. Cinematography uses a separate baseline worktree, but intentionally compares settled authored baseline FOV with responsive candidate FOV outside the opening, so visible counts may differ through framing.
- The legacy reports' `candidate` value records Git HEAD (`de8ce71…`), not a fingerprint of uncommitted working-tree changes. It must not be read as proof that candidate and baseline source were identical. Frozen source roots and the captured evidence distinguish the implementation; the candidate source fingerprint is recorded below and this document travels with its implementation commit.
- The browser uses software WebGL. Some runs overlapped and competed for CPU/software-GPU resources. Recorded median/p95 frame times are diagnostics, not desktop or mobile FPS certification, and no speed claim is made from them. Physical-device GPU time, memory pressure, thermal behaviour and input latency still require measurement.
- Zero reported page/render failures and passing budget checks do not establish final art direction, photorealism or production character animation. The GLBs remain explicitly identified placeholders with authored procedural fallbacks. Bespoke character models/rigs, authored bark and leaf textures, a full walking art-direction pass and real-device profiling remain valuable follow-up work.
- Water and mirrors approximate reflection; this implementation does not add live scene reflection, SSR, transmission or a second scene render. Low/reduced settings retain the main silhouettes while reducing surface detail and motion.
- Seeded late-game fixtures demonstrate appearance, not that the player earned the state through the canonical journey. Browser interaction/end-to-end results must be reported separately.

## Additional final evidence

- **Supplementary paired captures:** eight baseline and eight final captures; zero failures. These cover the corrected Crowned Return interior, completed witnessed epilogue, second floor reveal and river surrender, each in desktop High and mobile Low/reduced settings. Reports: `before-extra.json` and `final-extra.json`. Four separate Crowned Return recaptures replace the original window-depth views in `final.json`; `final-initial.json` preserves the earlier captures.
- **Expanded quality/device matrix:** 28 final captures with zero failures. Broken Floor, Blue Moon, Thorned House and Crowned Return each run at desktop Low/Medium/High/Cinematic, High with reduced effects, and Low/reduced mobile 393 × 851 and 851 × 393. Report: `tiers-final.json`. The baseline chapter matrix already includes Low/reduced portrait for all twelve chapters.
- **Mobile home interior:** two additional matched pairs, Low/reduced at 393 × 851 and 851 × 393, zero failures. The camera follows the home’s authored rotation; the generic chapter comparison cameras do not by themselves demonstrate its interior composition. Reports: `home-mobile-before.json` and `home-mobile-final.json`.
- **Final browser end-to-end coverage:** 23 applicable cases passed and 27 existing project-specific skips across the 50-case matrix. Repository Playwright 1.62.0 completed Chromium (5 passed / 5 skipped), Firefox (2 / 8), and mobile Chromium (10 / 0 across the original five passing cases and an unchanged five-case retry). Supplemental compatible WebKit coverage adds desktop (2 / 8) and mobile (4 / 6), as explained below. Mobile Chromium includes trusted touch position/look, portrait/landscape map controls, input cancellation, floor wipe/inversion, persisted reveal, and guidance recovery. No new skips or looser timeouts were introduced.
- **Candidate source and evidence packaging:** this document accompanies the implementation commit. The sorted `src` tree has SHA-256 `0346194710c9afe468118264c01a0619ac6f7abdd6a8931cb45d80df179aa493` (236 files; hash each relative path, NUL, file bytes, NUL in lexical order). Visual captures use a frozen copy; the only nonvisual differences are the build-generated `worldState.json` index/timestamp and trailing blank-line cleanup. The Codex task artifact `production-environment-upgrade/index.html` packages the before/after gallery, every referenced capture, renderer reports and test logs. These artifacts are local task files, not repository-hosted downloads. Temporary paths below document provenance.


## Mobile run interrupted by system sleep

The first mobile Chromium run recorded five passes and five failures over 57.1 minutes. Native macOS sleep records account for 54 minutes 19 seconds of that run and match the trace stalls. Two tests had passed their final assertions before context teardown was interrupted; a 20ms capture wait stalled for 315 seconds, and a touch command stalled for 921 seconds. The full accessible route was interrupted during the 3,200ms `fork.weighed` intentional-stillness event before the witnessed interval completed. Its unchanged focus/visibility-aware attention logic correctly stopped advancing while absent. The original log and compact timestamp diagnosis are retained in the gallery. The five cases were rerun unchanged with idle sleep prevented for the test process: **five passed, zero failures, 2.9 minutes**. Together with the original five passing cases, all ten mobile Chromium cases passed.

## WebKit host compatibility

The repository remains pinned to Playwright 1.62.0. On this macOS 14.8.3 ARM64 host its own manifest selects frozen WebKit revision 2251. The driver sends an unsupported `Page.overrideSetting: PushAPIEnabled` command, failing during `browserContext.newPage` before the application opens. Reinstalling the expected browser would not resolve that mismatch.

Supplemental WebKit coverage uses an isolated, unmodified upstream Playwright 1.61.0 runner with the same revision 2251 browser and byte-identical copies of the repository tests/configuration. SHA-256 manifests verify the copies. No repository dependency, browser protocol, assertion, skip or timeout was changed. It completed **six passed, 14 existing skips, zero failures** across desktop/mobile WebKit. Both completed the entire canonical accessible journey, including Heart/Womb choices; mobile also passed handedness/control sizing and blur/resize/pointer-cancellation resets.

This is passing supplemental compatibility coverage, not a claim that the repository-pinned 1.62.0 WebKit run passed on this host. The gallery includes `webkit-compatibility.md`, the integrity manifest, structured result and complete log. The original environment-failure log is retained separately.

## Evidence locations

| Local artifact | Contents |
| --- | --- |
| `/private/tmp/slipper-production-art/before.json` | Immutable baseline chapter measurements; paired `before-*.png` images alongside |
| `/private/tmp/slipper-production-art/final.json` | Frozen final chapter measurements; paired `final-*.png` images alongside |
| `/private/tmp/slipper-forest-production-review/report.json` | Seven forest pairs, readiness measurements and retained earlier failure diagnostics |
| `/private/tmp/slipper-visual-review/review.json` | Existing visual-presentation review |
| `/private/tmp/slipper-environment-review/review.json` | Existing environment review |
| `/private/tmp/slipper-cinematography-review/review.json` | Existing cinematography review and camera/input assertions |
| `/private/tmp/slipper-woodland-review/review.json` | Existing woodland review |
| `/private/tmp/slipper-art-check-publish.log` | Completed full check, 487 unit tests, seven security tests, production build and Functions compilation |

Reproduction commands and implementation ownership are documented in [Production environment art](PRODUCTION_ENVIRONMENT_ART.md), [Continuous forest production art](FOREST_ART_IMPLEMENTATION.md) and [Authored environment art toolkit](AUTHORED_ENVIRONMENT_ART.md). Reproduce comparisons against an immutable checkout with the same locked dependencies; run browser suites sequentially to avoid software-rendering contention.
