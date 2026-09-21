# Emotional arc QA

This is a source-grounded acceptance ledger. A checked implementation box is not a recipient playthrough, and an automated event-state test is not emotional or visual certification. Only enter a pass after observing the stated behaviour on the named build/device. Keep failures and unperformed checks visible.

## Current evidence

- Source baseline: `main` at `69ac3b7e393ee0c6e44fccb76323144d97f345de`; implementation branch `codex/emotional-cinematic-lived-story`. The canonical archive source has no diff; all 66 shipped fragments retain their exact prose.
- The original `/Users/warrenstear/Documents/Slippler` directory had an unborn `main` and an untracked snapshot; those files were preserved. Implementation used an isolated clone of remote `main`, then a durable checkout at `/Users/warrenstear/Documents/Slippler/current-main-implementation`. App code is committed as `5f6d9c88b556bc40515571598e59c3c9f01ac06a`; the completed QA ledger was committed separately as `ed50658502f43ea6936d90cf832e905326717259`. At that initial handoff, the feature branch had no upstream and had not been pushed.
- Raw supplied WhatsApp export SHA-256: `187f2f18a833e978a530641a44b62cbfefff84cced7764903c0c91bcf354d5d8`. Source photograph `00000281-PHOTO-2026-01-01-17-53-31.jpg` and the floor's `public/story-materials/forest-reflection.jpg` are byte-identical, SHA-256 `67711d8d3ead29d3c9ef319e5995347d187163851583855d908e59f40e66ff90`.
- Source reading: `00_START_HERE.md`, every referenced package document, all 2,234 lines of the raw WhatsApp export, both contact sheets and all 34 original images were reviewed before the implementation pass.
- The 32 canonical scene IDs and their Keystone assignments were audited against `journeyNarrative.ts`. The directing bible names all 32, with supplemental canonical prose explicitly distinguished from the supplied collation.
- The fresh production-build semantic object journey passed all 32 scenes and reload in all five configured projects: desktop Chromium, Firefox, WebKit, mobile Chromium and mobile WebKit. It exercised carried objects, Nest cross-scene drop/recovery, Womb material drop/re-pick, exact choices, the preserved memory, and timed reverse-light before constellation and dedication. No page errors were observed. This is semantic application evidence, not a visual recipient pass.
- The initial physical opening test found its focused object control hidden. That control was corrected. Desktop pointer and mobile Chromium trusted-touch openings passed two wipes followed by a touch, with no early inversion or software HUD. Live-Vite trial runs were replaced with production-build validation to avoid hot-reload changes during authored timers.
- Final candidate `npm run check` passed: validation/lint, content QA, both typechecks, 171 unit tests, 5 security tests, production build and Wrangler Pages Functions compilation. Focused Chromium story-order coverage also passed, including the post-surrender visual resume and return to the semantic route. The completed five-project Playwright evidence is recorded separately below.
- Deployment, live Cloudflare changes and gift release remain outside the authorised scope.

## Main publication

The user subsequently requested committing and pushing the validated implementation to `main`. The publication preflight confirmed that remote `main` remained at `69ac3b7e393ee0c6e44fccb76323144d97f345de`, so the update is a fast-forward. Repository workflows run validation on `main`; the materialisation workflow does not trigger because its own file is unchanged.

The baseline commit also has a successful Cloudflare Pages integration check. To preserve the no-deployment instruction, the final publication commit uses the `[CF-Pages-Skip]` prefix supported by [Cloudflare's GitHub integration](https://developers.cloudflare.com/pages/configuration/git-integration/github-integration/#skipping-a-build-via-a-commit-message). This opts this push out of Pages deployment while retaining GitHub validation CI. Publication does not turn the local evidence below into a successful remote CI result or production certification.

## Segmented browser matrix

Count unique project/test pairs, not duplicate reruns. The original matrix encountered obsolete coda assertions that searched the accessibility tree after the dedication correctly hid its background. The assertions now verify both the coda text and visible dedication. The run was intentionally interrupted so the remaining four projects could load corrected test definitions and the final arrival staging; its failures and interruption remain in the [original log](../review.local/logs/e2e-original-interrupted.log).

| Segment | Result | Evidence |
| --- | --- | --- |
| Desktop Chromium, all 29 cases | 24 unique passes, 5 intentional mobile-only skips | Original segment plus [three final reruns](../review.local/logs/e2e-final-chromium.log), all passing on port 4180 |
| Firefox, WebKit, mobile Chromium, mobile WebKit, 116 cases | 94 passes, 22 intentional skips, 0 failures; exit 0 in 29.2 minutes | [Final four-project log](../review.local/logs/e2e-final-four-projects.log), port 4177 |

Combined coverage is **118 unique passes and 27 intentional skips across all 145 configured cases**, with all original coda failures resolved by the corrected runs. By project: Chromium 24/5, Firefox 22/7, WebKit 22/7, mobile Chromium 27/2 and mobile WebKit 23/6 (passed/skipped).

The 27 skips are 15 mobile-only checks in desktop projects, two desktop-only checks in mobile projects, three physical opening checks outside Chromium, four seeded 3D ending checks outside desktop Chromium, and three mobile-WebKit exclusions for spatial map/orientation, guided recovery and continuous trusted-touch dispatch. These explicit renderer/input boundaries are not passes; semantic full-journey coverage ran in all five projects.

The final Chromium reruns cover both corrected full-journey coda tests and the actual two-wipe/touch opening. The later 4180 changes concern optional stillness timing/cancellation and the natural clearing radius; the targeted checks below cover both independently of the frozen 4177 matrix. The [final local check log](../review.local/logs/check.log) records the 171 unit tests, 5 security tests and build checks.

`review.local/` contains local QA evidence only and is ignored by Git. Logs, screenshots and runtime observations are kept there; the private raw source and temporary seeded snapshot files are not copied or committed.

## Recorded visual checkpoints

A [fresh opening capture](../review.local/checkpoints/fresh-opening-final/REVIEW.md) used Begin, two real wipe drags, Touch and eight seconds of rise without an injected save. All three images were reviewed: the supplied floor reflection is revealed, then one unowned guide lantern stands ahead between the trunks while no lantern is carried. Four opening events were accepted, `lanternOwned` remained false, and one canvas rendered without page errors or overflow. This is fresh opening coverage only.

Ten restored Chromium checkpoints were captured and visually reviewed at 1280 × 800, with Blue Moon also at 390 × 844: Blue Moon candle/water, Nest, House, preserved memory after Fire, River, Crowned Home, reverse-light Epilogue, recognised Crown before placement, and Fork weighing. All ten restored the expected scene, rendered one visible canvas, and produced no console/page errors, failed requests, error overlay or viewport overflow. The captures exposed legacy prose cards and decorative glyphs; the corrected visual mounts were captured again and those obstructions were gone. The preserved [before/after report](../review.local/checkpoints/REVIEW.md) records the observed compositions and limitations.

These are restored-state composition checks. Fire is captured after burning, not during each burn; Epilogue is captured while reverse-light is running and `storyCompleted` is false. An ordinary touch-look sweep revealed the Crown inside the mirror while the lantern remained carried, but its initial framing was off-axis. River and Fork also needed arrival composition correction. A separate final candidate at port 4177 corrected those arrivals: [three unchanged checkpoints](../review.local/checkpoints/arrival-correction/) then framed the River water/stones, both Fork routes and weighing stone, and the Crown reflection on entry. All three rendered the expected scene and one canvas without errors, failed requests or overflow. A [final accepted-window placement checkpoint](../review.local/checkpoints/placement-final/REVIEW.md) also showed the lantern flame on its surface, no carried lantern, the feather still held, 108 accepted events and `storyCompleted` false, without runtime errors. Source photograph byte preservation is verified above; rendered artistic resemblance, recipient interpretation, audio quality, physical devices and an unassisted full visual walk remain unverified.

The optional immersive stillness control was also corrected to use real elapsed time. A [targeted 4180 checkpoint](../review.local/checkpoints/surrender-assisted-final/REVIEW.md) held opposing movement keys to keep ordinary input active, entered assistance and remained incomplete after 3.061 seconds. Cancelling kept all 78 prior events unchanged for another 8.504 seconds. Restarting remained incomplete after 3.004 seconds and accepted at 7.993 seconds, after the authored 7.6-second minimum; the fabric rose and the event count became 79. No page errors or failed requests were observed. This checks optional timing and cancellation independently of the four-project matrix, which used the preceding 4177 candidate.

The default stillness checkpoint initially exposed a too-small standing radius. The final 4180 correction covers the quiet clearing and adds a regression for the real default arrival. [Repeating the unchanged 78-event checkpoint](../review.local/checkpoints/surrender-default-final/REVIEW.md) at the unchanged default position held the ordinary Look control for 14.085 seconds without acceptance. Releasing it then accepted naturally after 8.966 seconds of wall time, including polling, raised the fabric and reached 79 events. Assistance and guidance were off; the HUD remained empty, with no task, countdown or stillness prompt. No errors, failed requests or viewport overflow occurred. This is a targeted natural-stillness pass, not an unassisted full journey.

## Seven questions for every scene

1. What dominant and contradictory feelings are supported by the source?
2. What does the player physically do, and can they discover that action?
3. What changes in the environment because of the action?
4. How do camera, composition, movement, light and sound carry the contradiction?
5. What exact canonical words emerge, without invented redacted prose?
6. What meaningful consequence survives a reload and cloud sanitisation?
7. Does the next scene inherit the emotional exit instead of hard-switching mood?

A scene is incomplete if its physical answer is only a generic hold/press control, if its cinematography is only a fog colour, or if its emotion depends on explanatory software copy.

## Acceptance ledger

| Area | Required observed evidence | Status |
| --- | --- | --- |
| Floor discovery | First/second wipe materially differ; no inversion before touch; movement remains constrained until rise. | Pointer and trusted-touch sequences passed; three opening captures reviewed; constrained-movement check pending |
| Enchanted Wood | A new player willingly follows a moving/waiting light; Wolf crossing is readable and nonthreatening. | Awaiting recorded visual pass |
| Blue Moon beauty | Candle chain, water, waiting Swan, roses and origami are physically caused before contradiction. | Partial: candle warmth, reflective water, bridge and fabric visible in desktop/mobile checkpoints; fresh visual cause sequence pending |
| Blue Moon contradiction | Late reflection, missing candle/note, false door, loop and cage emerge sequentially while beauty stays real. | Awaiting recorded visual pass |
| Nest | Two held forms visibly consume capacity; compressed days express unsupported labour; safe placement keeps child-space safe. | Partial: both carried objects visibly present; semantic carry/drop/recovery passed; cycle animation and safe-space visual review pending |
| Seer | Direct/reflected evidence can be compared; motion distorts and stillness resolves; no tutorial explains truth first. | Awaiting recorded visual pass |
| House | Two rearrange/leave/return cycles are noticed; narrowing happens while present; leaving opens without chase/destruction. | Partial: compressed close framing visible without legacy prose obstruction; live two-cycle visual review pending |
| Capacities | Wolf-first and Swan-first both lead to necessary distinct environment changes and Seer alignment. | Awaiting both visual orders |
| Fire | Carried remnants burn differently; established true memory refuses flame; silence gives time to notice. | Partial: six burned remnants and preserved memory verified in state; post-burn scene visible; individual burn/silence review pending |
| River | Residue visibly washes away; frame/sound open; preserved memory does not disappear. | Partial: semantic wash preserves memory; corrected initial water/stones composition passed; live residue and sound review pending |
| Birds | A dense body hesitates, separates and departs over time, rather than instantly swapping geometry. | Awaiting recorded visual pass |
| Surrender | Default shows no task/countdown/progress; moving does not advance; natural stillness quiets actors and fabric. | Default and assisted checkpoint passes: active input blocks, natural stillness raises fabric, assistance waits and cancels correctly; full recipient walk pending |
| Fork | Past is walkable, warmer and looping; four physical verbs cause four different changes. | Partial: causal loop/four verbs passed semantically; corrected initial framing shows both routes and weighing stone; fresh visual walk pending |
| Lantern | After ownership it follows/responds; visual camera pull drops without an ownership message. | Awaiting recorded visual pass |
| Mind | Inspecting increases spatial density; walking leaves the questions physically behind. | Awaiting recorded visual pass |
| Heart | A chosen object travels; alternatives remain; familiar beauty returns without camera seduction. | Awaiting recorded visual pass |
| Womb | Choice culminates in construction; creation persists into the home. | Awaiting all creation variants |
| Home | Keys have physical consequences; Heart/Womb evidence is visible; optional domestic actions need no checklist. | Partial: furnished home, feather, lantern, books, chair, fountain and roses visible; full key/optional-action visual review pending |
| Crown | Crown exists only in reflection; stable player-owned framing; no acquisition fanfare. | Partial: Crown visible only inside the mirror while lantern remains carried; corrected arrival frames it immediately; audio/recognition sequence review pending |
| Placement | Each valid Lantern surface persists correctly; carried light ceases and placed light remains. | Partial: final window checkpoint shows placed flame, no carried lantern and retained feather; all surfaces have reducer coverage, other visual variants pending |
| Finale | Reverse-lit places retain their history; constellation uses actual route/choices; dedication waits. | Partial: reverse-light tableau captured before completion; full semantic ending and seeded desktop constellation-before-dedication passed; fresh visual reverse sequence pending |

## Automated and recovery checks

Use the repository scripts rather than inventing alternative validation commands:

```sh
npm run typecheck
npm run typecheck:functions
npm run lint
npm run content:qa
npm run test:unit
npm run test:security
npm run build
npm run wrangler:check
npm run test:e2e
```

The event contract suite must cover invalid scene/target inputs, missing prerequisites, repeat dispatch, separate wipe stages, carry capacity, safe set-down/re-pick, the non-burning memory, exclusive exact Heart/Womb choices, all final placements, and timed reverse-light before completion. Repeated rejected input must not mutate timestamps or story facts. A reload while carrying must retain the object; a reload during a signature event must reconstruct safe meaningful state without duplicating consequences.

Fresh semantic E2E must start from an empty browser profile and use visible production controls. Reading persisted state to assert outcomes is permitted; injecting completion state does not qualify as an interactive run. Existing seeded chapter/migration tests remain valuable for their narrower contracts and must not be relabelled as a walked journey.

Old navigation, schema-v1 and pre-event schema-v2 saves must preserve known canonical progress without inventing personal choices. Local/cloud sanitizers must agree on event IDs, state values, placements and bounds. Mocked authenticated cloud restore proves application behaviour, not deployed KV bindings or a real cross-device save.

## Device and accessibility record

| Route | Required variations | Evidence needed |
| --- | --- | --- |
| Desktop | Fresh, resume, keyboard/pointer, camera assistance off | Browser/version, build ID, screenshot, observed input and resulting object state |
| Mobile | Narrow touch portrait, safe areas, landscape if supported | Wipe/carry/place/stillness without tiny targets or overlay dominance |
| Semantic | No WebGL, keyboard, screen-reader semantics | Same 32 scenes and persistent facts; unwitnessed prose absent |
| Reduced motion | All signature events and transitions | Stable camera; no lost narrative evidence |
| Reduced effects | Low detail and zero optional particles | Event meaning and control discovery remain legible |
| Quality | Low, medium, high | Origami/birds bounded; measured frame-time samples, not qualitative FPS claims |
| Recovery | Fresh, in-progress carrying, completed, mocked cloud, old save | Before/after evidence with no invented choice or duplicate event |

The Browser plugin was unavailable in this session. The frontend-testing-debugging skill was used with the configured Playwright projects as the available automated browser route. Screenshot/trace artifacts belong to local test output and are evidence only for the cases actually executed.

### Software-renderer sample

Headless Chromium 151.0.7922.34 with SwiftShader sampled one restored epilogue checkpoint at 1280 × 800 on port 4177. After five seconds of warmup, each variant recorded eight seconds of page `requestAnimationFrame` delivery intervals. The host was shared with other QA, so these are scheduling samples, not GPU presentation measurements or a controlled quality comparison.

| Variant | Callback delivery per second | 95th percentile interval |
| --- | ---: | ---: |
| Low | 12.4 | 83.4 ms |
| Medium | 5.0 | 333.4 ms |
| High | 9.9 | 215.8 ms |
| Medium, reduced motion/effects | 13.4 | 84.2 ms |

Software throughput was poor. All four variants applied the requested settings and retained the visible world without context loss, page errors or failed requests. The low sample logged four ReadPixels driver-stall warnings. The four screenshots were visually reviewed and reduced settings preserved the visible tableau. This does not establish device frame rate, full-finale completion or acceptable performance on recipient hardware. See the [local raw report](../review.local/performance/report.json).

## Gift gate

Keep delivery local and reviewable. A gift release still requires clean desktop, mobile and accessible full runs, reduced motion/effects review, save/restore evidence, no premature Archive/Map exposure, exact source hash checks, and confirmation that the ignored private override is not staged. Missing checks remain missing; do not convert this ledger into a blanket certification.
