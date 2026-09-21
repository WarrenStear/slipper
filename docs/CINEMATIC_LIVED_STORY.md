# Cinematic lived story

This pass keeps the current authored 12-chapter / 32-scene route and the frozen 66-fragment archive. It adds a deterministic physical event layer, persistent story objects and emotional film direction. The raw WhatsApp writing and supplied photographs remain the highest creative authority; the full private source and private override file are not copied into committed documentation.

## Boundaries

`journeyNarrative.ts` owns narrative order. The six technical regions remain compatibility/rendering concerns. Progression owns eligibility; story events own authored transformations; renderers project the accepted evidence. No component should infer a major story event from prose keywords or introduce a second independent story clock.

The intended loop is observation, physical action, environmental response, exact prose, durable consequence and onward movement. Quiet scenes may use walking or stillness. Carrying is bounded to authored objects, with two responsibility slots in the Nest and preserved keepsakes where required; it is not a general inventory/crafting feature.

## Event and object contract

`src/storyEvents/storyEventTypes.ts` defines input triggers, explicit prerequisites and actions. `chapterStoryEvents.ts` holds authored objects and events. `storyEventRegistry.ts` supplies scene-scoped available events, object lookup, carry capacity and scene completion. `storyEventConditions.ts` checks prerequisites. `storyEventState.ts` accepts only events matching the current scene, object, target, duration and prerequisite snapshot.

The store's `dispatchStoryEvent` is the common entry point for immersive, mobile and semantic controls. An input cannot supply arbitrary outcomes. A single wipe resolves only the events eligible in its pre-input snapshot, so one gesture cannot consume both discovery stages. Completion groups allow one Heart memory, one Womb material/creation and one Lantern placement without making unchosen alternatives mandatory.

Meaningful state extends the existing save additively:

- `completedStoryEventIds`: accepted authored events, idempotent on repeat.
- `storyObjectStates`: bounded object states such as carried, placed, burned, preserved or created.
- `storyPlacementStates`: authored target IDs for meaningful final positions.

The existing schema-v2 story and local-storage envelope version 6 remain the compatibility contract. Older saves lack these additive fields. Sanitizers must permit known IDs/states, reject foreign values and preserve previously earned canonical progress without guessing a personal Heart/Womb choice. Cloud and local restore must carry the same fields. Animation frames, particle positions and an entire copy of private prose do not belong in the save.

## Causal scene requirements

| Chapter | Physical cause | Material consequence |
| --- | --- | --- |
| Broken Floor | Two reveal wipes, then touch | Forest becomes legible beneath room; inversion and rise unlock walking. |
| Enchanted Wood | Follow, rest, observe | Lantern leads and waits, Wolf crosses, meadow warms, hearth contradicts. |
| Blue Moon | Light, touch water, follow Swan, carry/place roses, touch origami, inspect/open | Candle chain, ripples, waiting Swan, placed flowers, awakened flock, sequential cage recognition. |
| Nest | Carry both responsibilities through cycles, safely place them | Weight is visible, shelter remains safe, protection key is recognised. |
| Sunset Seer | Compare and become still | Reflected absence, route and scar resolve without removing damage. |
| Thorned House | Rearrange, leave, return, repeat, stop and leave | Refill and compression remain; self-permission opens an exit. |
| Wolf/Swan/Seer | Meet either first, then both, then observe | Water passage, boundary and reflected destination converge. |
| Fire/River | Carry and burn, preserve true memory, enter/wash, release, become still | Distinct ash, intact memory, washed residue, bird separation and quiet white fabric. |
| Fork | Walk the past loop; release, close, depart, wipe; take Lantern | Familiar path loses its claim; light follows instead of leading. |
| Three Climbs | Walk beyond questions, take one memory, create | Questions stay behind; chosen object travels; something new persists. |
| Crowned Return | Approach with keys, freely inhabit, inspect reflection, place Lantern | Home holds earlier choices; crown is recognised; chosen placed flame remains. |
| Epilogue | Allow reverse light to unfold, observe | Actual remembered route becomes constellation only after reverse light completes. |

The complete directing contract, including contradictions, source anchors and all 32 signatures, is in `EMOTIONAL_CINEMATOGRAPHY_BIBLE.md`. It is deliberately more specific than a palette change.

## Accessibility and control equivalence

`AccessibleStoryObjects.tsx` renders the same available events as concrete semantic verbs and object/target labels. It initiates scene entry, records identical event/object/placement evidence, displays carrying, permits safe set-down where supported, and offers intentional stillness with cancellation. Timed attention waits the authored duration. Reverse light advances through the remembered places in time; it has no completion button.

`AccessibleStoryJourney.tsx` retains the witnessed-prose boundary and canonical reader. Its progression snapshot includes all three event fields. Legacy ritual/action controls remain compatibility code and are suppressed while the event-driven scene is active. Carried objects and optional home interactions remain available after required scene events settle, until the player continues. The semantic route remains usable without any canvas; a no-WebGL device should not receive a dead-end archive.

The immersive default must let Surrender ask nothing. No countdown, progress bar, instruction or generic interaction prompt belongs in that interval. Explicit accessible/assisted controls may communicate intentional stillness. Reduced motion removes camera attraction and involuntary movement, while light, sound and object-state changes preserve meaning. High contrast and text scaling still apply to the accessible exact-prose duplicate.

## Ending order

The required sequence is reflection recognition, player-chosen Lantern placement, held silence, reverse lighting of the remembered journey, constellation formation, dedication, then Free Woods. The reverse-light event has a real authored duration; final scene completion cannot bypass it. On reload the completed environmental state is restored without awarding a new crown or replacing the chosen placement.

## Evidence and limits

`e2e/cinematic-story-gameplay.spec.ts` exercises fresh semantic production controls without seeded story state, then checks a persisted reload. Its semantic controls are equivalent input, not proof that a first-time player discovers every object in 3D. A real rendered Broken Floor wipe/touch and full desktop/mobile/assisted visual runs are separate acceptance evidence.

Do not infer visual quality, frame pacing, live cloud restore, protected CI, merge, deployment or gift readiness from typecheck or state tests. Record actual commands/results and any incomplete checks in `EMOTIONAL_ARC_QA.md`. No automatic deployment is authorised by this document.
