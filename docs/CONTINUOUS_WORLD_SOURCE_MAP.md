# Approved source → continuous world map

Generated with `node --experimental-strip-types scripts/write-source-world-map.mjs`. The 12 chapters, 32 scenes and 66 approved fragments below remain the canonical catalogue. The willow is optional geography outside this catalogue.

The exact text is referenced at its approved source declaration and identified by a SHA-256 digest of its UTF-8 body. This avoids making another copy of the literary source or accidentally incorporating a private-edition overlay. Raw chat, private images and withheld passages are not inputs to this generator.

Physical residency is determined by camera position and quality. Story interaction, prose disclosure, progression and save validation still use the existing authoritative event system. The accessible journey uses those same event definitions and prerequisites. Scenery-only objects have separate identities, no event listeners, no prose, no inventory awards and no completion callbacks.

Revisits reconstruct accepted object states and placements from the existing journey store. Carried, burned and released objects are excluded from scenery copies. Unaccepted future actions are never synthesized. Local animations may restart after eviction; their progress is not evidence of a canonical action.

## The Broken Floor — `broken-floor.confession`

- **Narrative purpose:** Confession, fracture, and the first willingness to stand. Scene role: arrival.
- **Emotional tone:** Vulnerability, fracture, willingness.
- **Original symbols / physical objects:** Wet floor (`broken-floor.reflection`).
- **Physical landmark:** forest beneath ordinary wet timber. Anchor X/Z: 0, -378; ground height comes from the shared terrain sampler.
- **Natural environment:** `broken-floor-gives-way`; technical biome `firstWood`; motivated window light.
- **Meaningful interactions:** `broken-floor.confession.enter` (scene-enter); `broken-floor.first-wipe` (wipe, broken-floor.reflection); `broken-floor.forest-revealed` (wipe, broken-floor.reflection); `broken-floor.inversion` (touch, broken-floor.reflection).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=broken-floor.reflection, state=clearing`; `type=object-state, objectId=broken-floor.reflection, state=revealed`; `type=object-state, objectId=broken-floor.reflection, state=inverted`; `type=world-flag, flagId=path.first-wood-readable`; `type=world-flag, flagId=guidance.fireflies-awake`; `type=landmark, landmarkId=landmark.first-wood-lantern, state=awakened`.
- **Exact approved text:** [fragment-001](../src/data/slipperArchiveSource.ts#L461) (keystone), [fragment-002](../src/data/slipperArchiveSource.ts#L486) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Rabbit Hole — `enchanted.rabbit-hole`

- **Narrative purpose:** Attraction, warmth, friendship, and the first unspoken contradiction. Scene role: memory.
- **Emotional tone:** Curiosity, warmth, cautious trust.
- **Original symbols / physical objects:** Distant lantern (`enchanted.guide`).
- **Physical landmark:** distant lantern through layered trunks. Anchor X/Z: -8, -354; ground height comes from the shared terrain sampler.
- **Natural environment:** `enchanted-rabbit-hole-blooms`; technical biome `firstWood`; motivated canopy light.
- **Meaningful interactions:** `enchanted.rabbit-hole.enter` (scene-enter); `enchanted.follow-light` (volume-enter, enchanted.guide).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=enchanted.guide, state=followed`.
- **Exact approved text:** [fragment-008](../src/data/slipperArchiveSource.ts#L628) (keystone), [fragment-003](../src/data/slipperArchiveSource.ts#L507) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Friendship Meadow — `enchanted.friendship-meadow`

- **Narrative purpose:** Attraction, warmth, friendship, and the first unspoken contradiction. Scene role: memory.
- **Emotional tone:** Curiosity, warmth, cautious trust.
- **Original symbols / physical objects:** Meadow seat (`enchanted.rest`).
- **Physical landmark:** warm clearing inside cool woodland. Anchor X/Z: 10, -330; ground height comes from the shared terrain sampler.
- **Natural environment:** `enchanted-meadow-warms`; technical biome `firstWood`; motivated canopy light.
- **Meaningful interactions:** `enchanted.friendship-meadow.enter` (scene-enter); `enchanted.meadow-warmth` (stillness, enchanted.rest).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=enchanted.rest, state=witnessed`.
- **Exact approved text:** [fragment-010](../src/data/slipperArchiveSource.ts#L673) (keystone), [fragment-012](../src/data/slipperArchiveSource.ts#L723) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Masked Hearth — `enchanted.masked-hearth`

- **Narrative purpose:** Attraction, warmth, friendship, and the first unspoken contradiction. Scene role: transition.
- **Emotional tone:** Curiosity, warmth, cautious trust.
- **Original symbols / physical objects:** Quiet hearth (`enchanted.hearth`).
- **Physical landmark:** small domestic light behind branches. Anchor X/Z: -6, -306; ground height comes from the shared terrain sampler.
- **Natural environment:** `enchanted-hearth-contradiction`; technical biome `firstWood`; motivated canopy light.
- **Meaningful interactions:** `enchanted.masked-hearth.enter` (scene-enter); `enchanted.hearth-unease` (gaze, enchanted.hearth).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=enchanted.hearth, state=leaning-away`.
- **Exact approved text:** [fragment-006](../src/data/slipperArchiveSource.ts#L572) (keystone), [fragment-009](../src/data/slipperArchiveSource.ts#L646) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Sanctuary — `blue-moon.sanctuary`

- **Narrative purpose:** Beauty, intimacy, safety, and the recognition that beauty can still be wrong. Scene role: architectural.
- **Emotional tone:** Beauty, tenderness, contradiction.
- **Original symbols / physical objects:** First candle (`blue-moon.candle`); Moonlit water (`blue-moon.water`).
- **Physical landmark:** narrow bridge beneath the moon. Anchor X/Z: -14, -278; ground height comes from the shared terrain sampler.
- **Natural environment:** `blue-moon-sanctuary-awakens`; technical biome `archive`; motivated moon light.
- **Meaningful interactions:** `blue-moon.sanctuary.enter` (scene-enter); `blue-moon.candle-chain` (light, blue-moon.candle); `blue-moon.water-reveal` (touch, blue-moon.water).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=blue-moon.candle, state=lit`; `type=world-flag, flagId=blue-moon.candles-lit`; `type=object-state, objectId=blue-moon.water, state=rippled`; `type=world-flag, flagId=blue-moon.water-touched`.
- **Exact approved text:** [fragment-060](../src/data/slipperArchiveSource.ts#L1909) (keystone), [fragment-058](../src/data/slipperArchiveSource.ts#L1864) (echo), [fragment-049](../src/data/slipperArchiveSource.ts#L1604) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Powdered Wings — `blue-moon.intimacy`

- **Narrative purpose:** Beauty, intimacy, safety, and the recognition that beauty can still be wrong. Scene role: memory.
- **Emotional tone:** Beauty, tenderness, contradiction.
- **Original symbols / physical objects:** Swan (`blue-moon.swan`); Blush roses (`blue-moon.roses`); Paper Swan (`blue-moon.origami`); Pale door (`blue-moon.door`).
- **Physical landmark:** white cloth and Swan against black water. Anchor X/Z: 4, -252; ground height comes from the shared terrain sampler.
- **Natural environment:** `blue-moon-intimacy-reflects`; technical biome `archive`; motivated moon light.
- **Meaningful interactions:** `blue-moon.intimacy.enter` (scene-enter); `blue-moon.swan-followed` (volume-enter, blue-moon.swan); `blue-moon.roses-carried` (pickup, blue-moon.roses); `blue-moon.roses-placed` (place, blue-moon.roses); `blue-moon.origami-awakened` (touch, blue-moon.origami); `blue-moon.door-opened` (open, blue-moon.door).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=blue-moon.swan, state=followed`; `type=world-flag, flagId=blue-moon.swan-followed`; `type=object-state, objectId=blue-moon.roses, state=carried`; `type=object-state, objectId=blue-moon.roses, state=placed`; `type=placement, objectId=blue-moon.roses, targetId=blue-moon.table`; `type=world-flag, flagId=blue-moon.flowers-placed`; `type=object-state, objectId=blue-moon.origami, state=awakened`; `type=object-state, objectId=blue-moon.door, state=open`; `type=world-flag, flagId=blue-moon.beautiful-door-open`.
- **Exact approved text:** [fragment-063](../src/data/slipperArchiveSource.ts#L1978) (keystone), [fragment-061](../src/data/slipperArchiveSource.ts#L1933) (echo), [fragment-023](../src/data/slipperArchiveSource.ts#L980) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Caged Bird — `blue-moon.caged-bird`

- **Narrative purpose:** Beauty, intimacy, safety, and the recognition that beauty can still be wrong. Scene role: transition.
- **Emotional tone:** Beauty, tenderness, contradiction.
- **Original symbols / physical objects:** Water mirror (`blue-moon.cage-mirror`).
- **Physical landmark:** familiar bridge held by closed architecture. Anchor X/Z: 16, -226; ground height comes from the shared terrain sampler.
- **Natural environment:** `blue-moon-cage-becomes-visible`; technical biome `archive`; motivated moon light.
- **Meaningful interactions:** `blue-moon.caged-bird.enter` (scene-enter); `blue-moon.cage-reflected` (gaze, blue-moon.cage-mirror); `blue-moon.cage-recognised` (touch, blue-moon.cage-mirror).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=blue-moon.cage-mirror, state=reflected-cage`; `type=object-state, objectId=blue-moon.cage-mirror, state=physical-cage`; `type=symbol, objectId=memory.blue-moon`; `type=world-flag, flagId=archive.memory-carried`; `type=world-flag, flagId=archive.nostalgia-loops-closed`; `type=landmark, landmarkId=landmark.blue-moon-archive, state=witnessed`.
- **Exact approved text:** [fragment-062](../src/data/slipperArchiveSource.ts#L1956) (keystone), [fragment-050](../src/data/slipperArchiveSource.ts#L1633) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Two Hands — `nest.two-hands`

- **Narrative purpose:** Motherhood, protection, exhaustion, support, and the first owned key. Scene role: ritual.
- **Emotional tone:** Care, responsibility, protection.
- **Original symbols / physical objects:** Protected linen (`nest.protected-linen`); Responsibility basket (`nest.responsibility`).
- **Physical landmark:** protected linen centre in morning light. Anchor X/Z: 8, -200; ground height comes from the shared terrain sampler.
- **Natural environment:** `nest-two-hands-balance`; technical biome `firstWood`; motivated dawn light.
- **Meaningful interactions:** `nest.two-hands.enter` (scene-enter); `nest.first-hand` (pickup, nest.protected-linen); `nest.second-hand` (pickup, nest.responsibility).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=nest.protected-linen, state=carried`; `type=world-flag, flagId=nest.hand-held`; `type=object-state, objectId=nest.responsibility, state=carried`; `type=world-flag, flagId=nest.hand-kept`.
- **Exact approved text:** [fragment-017](../src/data/slipperArchiveSource.ts#L844) (keystone), [fragment-014](../src/data/slipperArchiveSource.ts#L775) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Unsupported Cycle — `nest.unsupported-cycle`

- **Narrative purpose:** Motherhood, protection, exhaustion, support, and the first owned key. Scene role: memory.
- **Emotional tone:** Care, responsibility, protection.
- **Original symbols / physical objects:** Protected linen (`nest.protected-linen`); Responsibility basket (`nest.responsibility`); Sunlit window (`nest.day`).
- **Physical landmark:** warm child space inside occupied edges. Anchor X/Z: -8, -176; ground height comes from the shared terrain sampler.
- **Natural environment:** `nest-weight-accumulates`; technical biome `firstWood`; motivated dawn light.
- **Meaningful interactions:** `nest.unsupported-cycle.enter` (scene-enter); `nest.days-compress` (gaze, nest.day); `nest.burden-set-down` (place, nest.responsibility); `nest.unsupported-cycle.recover-protected-linen` (pickup, nest.protected-linen); `nest.unsupported-cycle.recover-responsibility` (pickup, nest.responsibility).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=nest.day, state=compressed`; `type=world-flag, flagId=nest.unsupported-burden-held`; `type=object-state, objectId=nest.responsibility, state=placed`; `type=placement, objectId=nest.responsibility, targetId=nest.burden-rest`; `type=world-flag, flagId=nest.unsupported-burden-released`; `type=object-state, objectId=nest.protected-linen, state=carried`; `type=object-state, objectId=nest.responsibility, state=carried`.
- **Exact approved text:** [fragment-026](../src/data/slipperArchiveSource.ts#L1044) (keystone), [fragment-055](../src/data/slipperArchiveSource.ts#L1757) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Protection — `nest.protection`

- **Narrative purpose:** Motherhood, protection, exhaustion, support, and the first owned key. Scene role: ritual.
- **Emotional tone:** Care, responsibility, protection.
- **Original symbols / physical objects:** Protected linen (`nest.protected-linen`); Responsibility basket (`nest.responsibility`); Protection key (`nest.key`).
- **Physical landmark:** safe centre with breathing room. Anchor X/Z: 4, -152; ground height comes from the shared terrain sampler.
- **Natural environment:** `nest-protection-key-awakens`; technical biome `firstWood`; motivated dawn light.
- **Meaningful interactions:** `nest.protection.enter` (scene-enter); `nest.linen-sheltered` (place, nest.protected-linen); `nest.protection-recognised` (touch, nest.key); `nest.protection.recover-protected-linen` (pickup, nest.protected-linen); `nest.protection.recover-responsibility` (pickup, nest.responsibility).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=nest.protected-linen, state=placed`; `type=placement, objectId=nest.protected-linen, targetId=nest.safe-rest`; `type=object-state, objectId=nest.key, state=recognised`; `type=key, keyId=key.protection`; `type=world-flag, flagId=nest.protection-acknowledged`; `type=object-state, objectId=nest.protected-linen, state=carried`; `type=object-state, objectId=nest.responsibility, state=carried`.
- **Exact approved text:** [fragment-051](../src/data/slipperArchiveSource.ts#L1653) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Warning Grove — `sunset.warning-grove`

- **Narrative purpose:** Warnings, words against actions, stillness, and the truth already known. Scene role: reflection.
- **Emotional tone:** Witness, stillness, discernment.
- **Original symbols / physical objects:** Empty reflected chair (`sunset.chair`).
- **Physical landmark:** one cracked mirror against a dying horizon. Anchor X/Z: 18, -126; ground height comes from the shared terrain sampler.
- **Natural environment:** `sunset-seer-warnings-gather`; technical biome `mirror`; motivated sunset light.
- **Meaningful interactions:** `sunset.warning-grove.enter` (scene-enter); `sunset.chair.seen` (gaze, sunset.chair).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=sunset.chair, state=absence`.
- **Exact approved text:** [fragment-011](../src/data/slipperArchiveSource.ts#L701) (keystone), [fragment-039](../src/data/slipperArchiveSource.ts#L1324) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The True Mirror — `sunset.true-mirror`

- **Narrative purpose:** Warnings, words against actions, stillness, and the truth already known. Scene role: reflection.
- **Emotional tone:** Witness, stillness, discernment.
- **Original symbols / physical objects:** High mirror (`sunset.mirror`).
- **Physical landmark:** unchanged scar in reflected landscape. Anchor X/Z: 0, -102; ground height comes from the shared terrain sampler.
- **Natural environment:** `sunset-mirror-resolves`; technical biome `mirror`; motivated sunset light.
- **Meaningful interactions:** `sunset.true-mirror.enter` (scene-enter); `sunset.mirror.seen` (gaze, sunset.mirror).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=sunset.mirror, state=route-visible`.
- **Exact approved text:** [fragment-025](../src/data/slipperArchiveSource.ts#L1020) (keystone), [fragment-029](../src/data/slipperArchiveSource.ts#L1114) (echo), [fragment-020](../src/data/slipperArchiveSource.ts#L919) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Stillness — `sunset.stillness`

- **Narrative purpose:** Warnings, words against actions, stillness, and the truth already known. Scene role: ritual.
- **Emotional tone:** Witness, stillness, discernment.
- **Original symbols / physical objects:** Still water (`sunset.truth`).
- **Physical landmark:** a truthful mirror in settled water. Anchor X/Z: -14, -78; ground height comes from the shared terrain sampler.
- **Natural environment:** `sunset-stillness-deepens`; technical biome `mirror`; motivated sunset light.
- **Meaningful interactions:** `sunset.stillness.enter` (scene-enter); `sunset.truth.seen` (stillness, sunset.truth).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=sunset.truth, state=synchronised`; `type=world-flag, flagId=mirror.reflections-truthful`; `type=world-flag, flagId=path.reflected-route-visible`; `type=landmark, landmarkId=landmark.mirror, state=scarred`.
- **Exact approved text:** [fragment-040](../src/data/slipperArchiveSource.ts#L1343) (keystone), [fragment-013](../src/data/slipperArchiveSource.ts#L746) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Locked Garden — `thorned.locked-garden`

- **Narrative purpose:** False sanctuary, compression, accommodation, and self-permission. Scene role: architectural.
- **Emotional tone:** Pressure, ambiguity, boundaries.
- **Original symbols / physical objects:** House chair (`thorn-house.chair`); House threshold (`thorn-house.threshold`).
- **Physical landmark:** warm invitation inside enclosing walls. Anchor X/Z: -6, -50; ground height comes from the shared terrain sampler.
- **Natural environment:** `thorned-house-locked-garden`; technical biome `thorned`; motivated domestic light.
- **Meaningful interactions:** `thorned.locked-garden.enter` (scene-enter); `thorn-house.chair-carried` (pickup, thorn-house.chair); `thorn-house.space-cleared` (place, thorn-house.chair); `thorn-house.first-departure` (volume-exit, thorn-house.threshold); `thorn-house.refilled` (volume-enter, thorn-house.threshold).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=thorn-house.chair, state=carried`; `type=object-state, objectId=thorn-house.chair, state=placed`; `type=placement, objectId=thorn-house.chair, targetId=thorn-house.cleared-space`; `type=world-flag, flagId=thorn-house.space-cleared`; `type=object-state, objectId=thorn-house.table, state=waiting`; `type=object-state, objectId=thorn-house.table, state=refilled`; `type=object-state, objectId=thorn-house.chair, state=reset`; `type=world-flag, flagId=thorn-house.space-refilled`.
- **Exact approved text:** [fragment-005](../src/data/slipperArchiveSource.ts#L551) (keystone), [fragment-007](../src/data/slipperArchiveSource.ts#L606) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Old-Memory Bedroom — `thorned.old-memory-bedroom`

- **Narrative purpose:** False sanctuary, compression, accommodation, and self-permission. Scene role: architectural.
- **Emotional tone:** Pressure, ambiguity, boundaries.
- **Original symbols / physical objects:** House threshold (`thorn-house.threshold`); Old frame (`thorn-house.frame`).
- **Physical landmark:** room that leaves too little space. Anchor X/Z: 8, -24; ground height comes from the shared terrain sampler.
- **Natural environment:** `thorned-house-compresses`; technical biome `thorned`; motivated domestic light.
- **Meaningful interactions:** `thorned.old-memory-bedroom.enter` (scene-enter); `thorn-house.frame-carried` (pickup, thorn-house.frame); `thorn-house.frame-rearranged` (place, thorn-house.frame); `thorn-house.second-departure` (volume-exit, thorn-house.threshold); `thorn-house.pattern-returned` (volume-enter, thorn-house.threshold); `thorn-house.fixing-ended` (stillness, thorn-house.frame).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=thorn-house.frame, state=carried`; `type=object-state, objectId=thorn-house.frame, state=placed`; `type=placement, objectId=thorn-house.frame, targetId=thorn-house.shelf`; `type=object-state, objectId=thorn-house.table, state=waiting-again`; `type=object-state, objectId=thorn-house.frame, state=reset`; `type=object-state, objectId=thorn-house.table, state=refilled-twice`; `type=object-state, objectId=thorn-house.frame, state=left`; `type=world-flag, flagId=thorn-house.reorganisation-released`.
- **Exact approved text:** [fragment-032](../src/data/slipperArchiveSource.ts#L1174) (keystone), [fragment-048](../src/data/slipperArchiveSource.ts#L1581) (echo), [fragment-031](../src/data/slipperArchiveSource.ts#L1154) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Self-Owned World — `thorned.self-owned-world`

- **Narrative purpose:** False sanctuary, compression, accommodation, and self-permission. Scene role: transition.
- **Emotional tone:** Pressure, ambiguity, boundaries.
- **Original symbols / physical objects:** Own key (`thorn-house.key`); Open exit (`thorn-house.exit`).
- **Physical landmark:** outside air through a readable exit. Anchor X/Z: 18, 2; ground height comes from the shared terrain sampler.
- **Natural environment:** `thorned-house-exit-opens`; technical biome `thorned`; motivated window light.
- **Meaningful interactions:** `thorned.self-owned-world.enter` (scene-enter); `thorn-house.key-recognised` (touch, thorn-house.key); `thorn-house.exit-crossed` (volume-enter, thorn-house.exit).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=thorn-house.key, state=recognised`; `type=key, keyId=key.self-permission`; `type=world-flag, flagId=thorn-door.open`; `type=world-flag, flagId=path.house-exit-open`; `type=landmark, landmarkId=landmark.thorn-door, state=transformed`; `type=world-flag, flagId=thorn-house.exit-crossed`; `type=object-state, objectId=thorn-house.exit, state=open`.
- **Exact approved text:** [fragment-054](../src/data/slipperArchiveSource.ts#L1736) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The False Choice — `wolf-swan.false-choice`

- **Narrative purpose:** Tenderness, boundary, and discernment integrated without a binary choice. Scene role: memory.
- **Emotional tone:** Contradiction held without erasure.
- **Original symbols / physical objects:** Swan water passage (`integration.swan`); Wolf boundary (`integration.wolf`); Seer mirror (`integration.seer`).
- **Physical landmark:** wood and water sharing the same stone. Anchor X/Z: 6, 28; ground height comes from the shared terrain sampler.
- **Natural environment:** `wolf-swan-paths-converge`; technical biome `mirror`; motivated sky light.
- **Meaningful interactions:** `wolf-swan.false-choice.enter` (scene-enter); `integration.swan-passage` (volume-enter, integration.swan); `integration.wolf-boundary` (volume-enter, integration.wolf); `integration.seer-truth` (stillness, integration.seer).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=world-flag, flagId=integration.swan-witnessed`; `type=object-state, objectId=integration.swan, state=passage`; `type=world-flag, flagId=integration.wolf-witnessed`; `type=object-state, objectId=integration.wolf, state=boundary`; `type=world-flag, flagId=integration.seer-witnessed`; `type=object-state, objectId=integration.seer, state=aligned`.
- **Exact approved text:** [fragment-027](../src/data/slipperArchiveSource.ts#L1069) (keystone), [fragment-021](../src/data/slipperArchiveSource.ts#L942) (echo), [fragment-024](../src/data/slipperArchiveSource.ts#L999) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Convergence — `wolf-swan.convergence`

- **Narrative purpose:** Tenderness, boundary, and discernment integrated without a binary choice. Scene role: ritual.
- **Emotional tone:** Contradiction held without erasure.
- **Original symbols / physical objects:** Meeting ring (`integration.meeting`).
- **Physical landmark:** one open passage through three familiar materials. Anchor X/Z: -8, 54; ground height comes from the shared terrain sampler.
- **Natural environment:** `seer-integrates-wolf-swan`; technical biome `mirror`; motivated sky light.
- **Meaningful interactions:** `wolf-swan.convergence.enter` (scene-enter); `integration.three-capacities` (stillness, integration.meeting).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=world-flag, flagId=integration.three-aspects-held`; `type=object-state, objectId=integration.meeting, state=aligned`.
- **Exact approved text:** [fragment-028](../src/data/slipperArchiveSource.ts#L1091) (keystone), [fragment-064](../src/data/slipperArchiveSource.ts#L2006) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Boundary Fire — `fire.boundary`

- **Narrative purpose:** Boundary, grief, release, and surrender without erasing memory. Scene role: ritual.
- **Emotional tone:** Release, cleansing, surrender.
- **Original symbols / physical objects:** Promise remnant (`fire.false-promise`); Obsolete path marker (`fire.old-marker`); Empty frame (`fire.empty-frame`); Broken copy of a key (`fire.broken-key`); Dead flower (`fire.dead-flower`); Letter remnant (`fire.letter`); Blush rose memory (`fire.true-memory`); Contained fire (`fire.flame`).
- **Physical landmark:** contained fire beside a broad dark river. Anchor X/Z: -18, 82; ground height comes from the shared terrain sampler.
- **Natural environment:** `fire-boundary-burns`; technical biome `fireRiver`; motivated fire light.
- **Meaningful interactions:** `fire.boundary.enter` (scene-enter); `fire.false-promise.take` (pickup, fire.false-promise); `fire.false-promise.flame` (burn, fire.false-promise); `fire.old-marker.take` (pickup, fire.old-marker); `fire.old-marker.flame` (burn, fire.old-marker); `fire.empty-frame.take` (pickup, fire.empty-frame); `fire.empty-frame.flame` (burn, fire.empty-frame); `fire.broken-key.take` (pickup, fire.broken-key); `fire.broken-key.flame` (burn, fire.broken-key); `fire.dead-flower.take` (pickup, fire.dead-flower); `fire.dead-flower.flame` (burn, fire.dead-flower); `fire.letter.take` (pickup, fire.letter); `fire.letter.flame` (burn, fire.letter); `fire.true-memory.take` (pickup, fire.true-memory); `fire.true-memory.flame` (burn, fire.true-memory); `fire.boundary-complete` (stillness, fire.flame).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=fire.false-promise, state=carried`; `type=object-state, objectId=fire.false-promise, state=burned`; `type=placement, objectId=fire.false-promise, targetId=fire.flame`; `type=object-state, objectId=river.soot, state=present`; `type=object-state, objectId=fire.old-marker, state=carried`; `type=object-state, objectId=fire.old-marker, state=burned`; `type=placement, objectId=fire.old-marker, targetId=fire.flame`; `type=object-state, objectId=fire.empty-frame, state=carried`; `type=object-state, objectId=fire.empty-frame, state=burned`; `type=placement, objectId=fire.empty-frame, targetId=fire.flame`; `type=object-state, objectId=fire.broken-key, state=carried`; `type=object-state, objectId=fire.broken-key, state=burned`; `type=placement, objectId=fire.broken-key, targetId=fire.flame`; `type=object-state, objectId=fire.dead-flower, state=carried`; `type=object-state, objectId=fire.dead-flower, state=burned`; `type=placement, objectId=fire.dead-flower, targetId=fire.flame`; `type=object-state, objectId=fire.letter, state=carried`; `type=object-state, objectId=fire.letter, state=burned`; `type=placement, objectId=fire.letter, targetId=fire.flame`; `type=object-state, objectId=fire.true-memory, state=carried`; `type=object-state, objectId=fire.true-memory, state=preserved`; `type=placement, objectId=fire.true-memory, targetId=fire.flame`; `type=world-flag, flagId=fire.boundary-burned`; `type=landmark, landmarkId=landmark.fire-river, state=scarred`.
- **Exact approved text:** [fragment-053](../src/data/slipperArchiveSource.ts#L1704) (keystone), [fragment-004](../src/data/slipperArchiveSource.ts#L529) (echo), [fragment-041](../src/data/slipperArchiveSource.ts#L1370) (echo), [fragment-036](../src/data/slipperArchiveSource.ts#L1260) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The River Wash — `river.wash`

- **Narrative purpose:** Boundary, grief, release, and surrender without erasing memory. Scene role: ritual.
- **Emotional tone:** Release, cleansing, surrender.
- **Original symbols / physical objects:** Moving river (`river.water`).
- **Physical landmark:** open water with remembered embers in view. Anchor X/Z: 14, 110; ground height comes from the shared terrain sampler.
- **Natural environment:** `river-residue-clears`; technical biome `fireRiver`; motivated moon light.
- **Meaningful interactions:** `river.wash.enter` (scene-enter); `river.entered` (volume-enter, river.water); `river.ash-washed` (wash, river.water).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=river.soot, state=loosening`; `type=object-state, objectId=river.soot, state=washed`; `type=world-flag, flagId=river.grief-washed`.
- **Exact approved text:** [fragment-034](../src/data/slipperArchiveSource.ts#L1213) (keystone), [fragment-052](../src/data/slipperArchiveSource.ts#L1684) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Release and Surrender — `river.release-surrender`

- **Narrative purpose:** Boundary, grief, release, and surrender without erasing memory. Scene role: ritual.
- **Emotional tone:** Release, cleansing, surrender.
- **Original symbols / physical objects:** Gathered black birds (`river.birds`); White fabric (`river.white-fabric`).
- **Physical landmark:** still cloth between water and extinguished ash. Anchor X/Z: 0, 138; ground height comes from the shared terrain sampler.
- **Natural environment:** `black-birds-depart-white-flag-rises`; technical biome `fireRiver`; motivated moon light.
- **Meaningful interactions:** `river.release-surrender.enter` (scene-enter); `river.birds-released` (release, river.birds); `river.surrender` (stillness, river.white-fabric).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=river.birds, state=released`; `type=world-flag, flagId=river.memory-released`; `type=world-flag, flagId=birds.black-swarm-released`; `type=landmark, landmarkId=landmark.fire-river, state=released`; `type=release-word, word=hope`; `type=object-state, objectId=river.white-fabric, state=raised`; `type=world-flag, flagId=surrender.white-flag-raised`; `type=world-flag, flagId=path.crowned-return-visible`.
- **Exact approved text:** [fragment-057](../src/data/slipperArchiveSource.ts#L1817) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Weighing — `fork.weighing`

- **Narrative purpose:** Weighing the self, ending the loop, and taking ownership of the lantern. Scene role: ritual.
- **Emotional tone:** Discernment and relinquishment.
- **Original symbols / physical objects:** Familiar path (`fork.past`); Weighing stone (`fork.weighing-stone`).
- **Physical landmark:** enclosed familiar bend beside an unreadable horizon. Anchor X/Z: -4, 166; ground height comes from the shared terrain sampler.
- **Natural environment:** `fork-paths-wait`; technical biome `firstWood`; motivated sky light.
- **Meaningful interactions:** `fork.weighing.enter` (scene-enter); `fork.past-entered` (volume-enter, fork.past); `fork.past-looped` (volume-exit, fork.past); `fork.weighed` (stillness, fork.weighing-stone).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=fork.past, state=entered`; `type=object-state, objectId=fork.past, state=looped`; `type=world-flag, flagId=fork.weighed`.
- **Exact approved text:** [fragment-059](../src/data/slipperArchiveSource.ts#L1888) (keystone), [fragment-037](../src/data/slipperArchiveSource.ts#L1280) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Four Verbs — `fork.four-verbs`

- **Narrative purpose:** Weighing the self, ending the loop, and taking ownership of the lantern. Scene role: ritual.
- **Emotional tone:** Discernment and relinquishment.
- **Original symbols / physical objects:** Old token (`fork.token`); Familiar door (`fork.door`); Obsolete path mark (`fork.mark`).
- **Physical landmark:** warmth held behind a chosen door. Anchor X/Z: 10, 190; ground height comes from the shared terrain sampler.
- **Natural environment:** `fork-actions-enter-world`; technical biome `firstWood`; motivated sky light.
- **Meaningful interactions:** `fork.four-verbs.enter` (scene-enter); `fork.token-carried` (pickup, fork.token); `fork.let-go` (release, fork.token); `fork.declined` (close, fork.door); `fork.departed` (volume-exit, fork.door); `fork.deleted` (wipe, fork.mark).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=fork.token, state=carried`; `type=object-state, objectId=fork.token, state=released`; `type=world-flag, flagId=fork.let-go`; `type=object-state, objectId=fork.door, state=closed`; `type=world-flag, flagId=fork.declined`; `type=world-flag, flagId=fork.departed`; `type=object-state, objectId=fork.mark, state=erased`; `type=world-flag, flagId=fork.deleted`.
- **Exact approved text:** [fragment-018](../src/data/slipperArchiveSource.ts#L872) (keystone), [fragment-016](../src/data/slipperArchiveSource.ts#L821) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Relinquish Hope — `fork.relinquish-hope`

- **Narrative purpose:** Weighing the self, ending the loop, and taking ownership of the lantern. Scene role: transition.
- **Emotional tone:** Discernment and relinquishment.
- **Original symbols / physical objects:** Old hope blooms (`fork.hope`); Master Lantern (`lantern.master`).
- **Physical landmark:** waiting light beside an unpromised horizon. Anchor X/Z: -10, 214; ground height comes from the shared terrain sampler.
- **Natural environment:** `fork-owned-lantern-brightens`; technical biome `firstWood`; motivated sky light.
- **Meaningful interactions:** `fork.relinquish-hope.enter` (scene-enter); `fork.hope-relinquished` (release, fork.hope); `lantern.owned` (pickup, lantern.master).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=fork.hope, state=released`; `type=world-flag, flagId=fork.old-hope-relinquished`; `type=object-state, objectId=lantern.master, state=carried`; `type=world-flag, flagId=lantern.owned`.
- **Exact approved text:** [fragment-056](../src/data/slipperArchiveSource.ts#L1790) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Three Climbs Ahead — `climbs.arrival`

- **Narrative purpose:** Mind, heart, and womb faced as distinct climbs into sovereignty. Scene role: arrival.
- **Emotional tone:** Release of thought, grief, creative agency.
- **Original symbols / physical objects:** Open ascent (`climbs.horizon`).
- **Physical landmark:** continuous ascent above remembered places. Anchor X/Z: 0, 242; ground height comes from the shared terrain sampler.
- **Natural environment:** `three-climbs-reveal`; technical biome `crowned`; motivated sky light.
- **Meaningful interactions:** `climbs.arrival.enter` (scene-enter); `climbs.ascent-seen` (volume-enter, climbs.horizon).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=climbs.horizon, state=visible`.
- **Exact approved text:** [fragment-043](../src/data/slipperArchiveSource.ts#L1415) (keystone), [fragment-015](../src/data/slipperArchiveSource.ts#L796) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Mind — `climb.mind`

- **Narrative purpose:** Mind, heart, and womb faced as distinct climbs into sovereignty. Scene role: climb.
- **Emotional tone:** Release of thought, grief, creative agency.
- **Original symbols / physical objects:** Questions (`mind.questions`); Onward path (`mind.onward`).
- **Physical landmark:** angular repetition yielding to clear space. Anchor X/Z: -14, 268; ground height comes from the shared terrain sampler.
- **Natural environment:** `mind-climb-questions-fade`; technical biome `crowned`; motivated sky light.
- **Meaningful interactions:** `climb.mind.enter` (scene-enter); `mind.questions-examined` (gaze, mind.questions); `mind.questions-left` (volume-enter, mind.onward).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=mind.questions, state=dense`; `type=object-state, objectId=mind.questions, state=behind`; `type=world-flag, flagId=climb.mind.questions-released`.
- **Exact approved text:** [fragment-022](../src/data/slipperArchiveSource.ts#L961) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Heart — `climb.heart`

- **Narrative purpose:** Mind, heart, and womb faced as distinct climbs into sovereignty. Scene role: climb.
- **Emotional tone:** Release of thought, grief, creative agency.
- **Original symbols / physical objects:** Blush rose (`heart.rose`); Swan feather (`heart.feather`); Blue Moon reflection (`heart.reflection`).
- **Physical landmark:** one tender object within intimate curved shelter. Anchor X/Z: 10, 294; ground height comes from the shared terrain sampler.
- **Natural environment:** `heart-climb-sanctuary-visible`; technical biome `crowned`; motivated sky light.
- **Meaningful interactions:** `climb.heart.enter` (scene-enter); `heart.rose.chosen` (pickup, heart.rose); `heart.feather.chosen` (pickup, heart.feather); `heart.reflection.chosen` (pickup, heart.reflection).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=heart.rose, state=carried`; `type=object-state, objectId=heart.memory, state=blush-rose`; `type=symbol, objectId=memory.chosen-heart`; `type=symbol, objectId=memory.heart.tenderness`; `type=world-flag, flagId=climb.heart.memory-chosen`; `type=object-state, objectId=heart.feather, state=carried`; `type=object-state, objectId=heart.memory, state=swan-feather`; `type=symbol, objectId=memory.heart.beauty`; `type=object-state, objectId=heart.reflection, state=carried`; `type=object-state, objectId=heart.memory, state=blue-moon-reflection`; `type=symbol, objectId=memory.heart.selfhood`.
- **Exact approved text:** [fragment-030](../src/data/slipperArchiveSource.ts#L1133) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Womb — `climb.womb`

- **Narrative purpose:** Mind, heart, and womb faced as distinct climbs into sovereignty. Scene role: climb.
- **Emotional tone:** Release of thought, grief, creative agency.
- **Original symbols / physical objects:** Folded linen (`womb.linen`); Unlit home light (`womb.light`); Unwritten page (`womb.page`).
- **Physical landmark:** protected empty earth under diffuse sky. Anchor X/Z: -2, 320; ground height comes from the shared terrain sampler.
- **Natural environment:** `womb-climb-creation-opens`; technical biome `crowned`; motivated sky light.
- **Meaningful interactions:** `climb.womb.enter` (scene-enter); `womb.linen.take` (pickup, womb.linen); `womb.linen.created` (place, womb.linen); `womb.light.take` (pickup, womb.light); `womb.light.created` (place, womb.light); `womb.page.take` (pickup, womb.page); `womb.page.created` (place, womb.page).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=womb.linen, state=carried`; `type=object-state, objectId=womb.linen, state=created`; `type=placement, objectId=womb.linen, targetId=womb.rest-space`; `type=object-state, objectId=womb.creation, state=rest`; `type=symbol, objectId=creation.chosen-future`; `type=symbol, objectId=creation.future.rest`; `type=world-flag, flagId=climb.womb.creation-chosen`; `type=object-state, objectId=womb.light, state=carried`; `type=object-state, objectId=womb.light, state=created`; `type=placement, objectId=womb.light, targetId=womb.threshold`; `type=object-state, objectId=womb.creation, state=home`; `type=symbol, objectId=creation.future.home`; `type=object-state, objectId=womb.page, state=carried`; `type=object-state, objectId=womb.page, state=created`; `type=placement, objectId=womb.page, targetId=womb.writing-place`; `type=object-state, objectId=womb.creation, state=voice`; `type=symbol, objectId=creation.future.voice`.
- **Exact approved text:** [fragment-066](../src/data/slipperArchiveSource.ts#L2056) (keystone), [fragment-042](../src/data/slipperArchiveSource.ts#L1389) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Crowned Threshold — `crowned.threshold`

- **Narrative purpose:** A self-owned crown, an already-whole home, and room without dependence. Scene role: transition.
- **Emotional tone:** Self-possession, recognition, sovereignty.
- **Original symbols / physical objects:** Home gate (`home.gate`).
- **Physical landmark:** ordinary morning through an already-owned gate. Anchor X/Z: 6, 346; ground height comes from the shared terrain sampler.
- **Natural environment:** `crowned-gate-recognises-key`; technical biome `crowned`; motivated dawn light.
- **Meaningful interactions:** `crowned.threshold.enter` (scene-enter); `home.gate-recognises-keys` (volume-enter, home.gate).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=home.gate, state=open`.
- **Exact approved text:** [fragment-035](../src/data/slipperArchiveSource.ts#L1232) (keystone), [fragment-065](../src/data/slipperArchiveSource.ts#L2029) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Home She Made — `crowned.home`

- **Narrative purpose:** A self-owned crown, an already-whole home, and room without dependence. Scene role: architectural.
- **Emotional tone:** Self-possession, recognition, sovereignty.
- **Original symbols / physical objects:** Living fountain (`home.water`); Open book (`home.book`); Protected child-space (`home.child-space`); Window curtain (`home.window`); Private room (`home.private-room`).
- **Physical landmark:** inhabited timber home open to morning. Anchor X/Z: -8, 370; ground height comes from the shared terrain sampler.
- **Natural environment:** `crowned-home-becomes-whole`; technical biome `crowned`; motivated dawn light.
- **Meaningful interactions:** `crowned.home.enter` (scene-enter); `home.continuity` (scene-enter); `home.water.visited` (touch, home.water); `home.book.visited` (open, home.book); `home.child-space.visited` (inspect, home.child-space); `home.window.visited` (open, home.window); `home.private-room-opened` (volume-enter, home.private-room).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=home.continuity, state=present`; `type=object-state, objectId=home.water, state=rippled`; `type=object-state, objectId=home.book, state=open`; `type=object-state, objectId=home.child-space, state=protected`; `type=object-state, objectId=home.window, state=open`; `type=object-state, objectId=home.private-room, state=open`.
- **Exact approved text:** [fragment-038](../src/data/slipperArchiveSource.ts#L1301) (keystone), [fragment-019](../src/data/slipperArchiveSource.ts#L897) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Sovereignty — `crowned.sovereignty`

- **Narrative purpose:** A self-owned crown, an already-whole home, and room without dependence. Scene role: finale.
- **Emotional tone:** Self-possession, recognition, sovereignty.
- **Original symbols / physical objects:** Master Lantern (`lantern.master`); Crown reflection (`home.crown-mirror`).
- **Physical landmark:** recognition in the mirror beside placed light. Anchor X/Z: 10, 394; ground height comes from the shared terrain sampler.
- **Natural environment:** `crown-waits-unclaimed`; technical biome `crowned`; motivated dawn light.
- **Meaningful interactions:** `crowned.sovereignty.enter` (scene-enter); `crown.recognised` (gaze, home.crown-mirror); `crown.integrated` (touch, home.crown-mirror); `lantern.placed.mirror` (place, lantern.master); `lantern.placed.reading-nook` (place, lantern.master); `lantern.placed.fountain` (place, lantern.master); `lantern.placed.window` (place, lantern.master).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=home.crown-mirror, state=recognised`; `type=object-state, objectId=home.crown-mirror, state=integrated`; `type=object-state, objectId=lantern.master, state=placed`; `type=placement, objectId=lantern.master, targetId=mirror`; `type=object-state, objectId=lantern.final-placement, state=mirror`; `type=world-flag, flagId=lantern.placed-and-lit`; `type=landmark, landmarkId=landmark.crowned-gate, state=released`; `type=placement, objectId=lantern.master, targetId=reading-nook`; `type=object-state, objectId=lantern.final-placement, state=reading-nook`; `type=placement, objectId=lantern.master, targetId=fountain`; `type=object-state, objectId=lantern.final-placement, state=fountain`; `type=placement, objectId=lantern.master, targetId=window`; `type=object-state, objectId=lantern.final-placement, state=window`.
- **Exact approved text:** [fragment-044](../src/data/slipperArchiveSource.ts#L1441) (keystone).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## The Lantern Constellation — `epilogue.constellation`

- **Narrative purpose:** The travelled world gathers into a constellation of remembered light. Scene role: finale.
- **Emotional tone:** Integration, remembered light, continued freedom.
- **Original symbols / physical objects:** Witnessed places and remembered light.
- **Physical landmark:** the actual remembered route lit in reverse. Anchor X/Z: 0, 416; ground height comes from the shared terrain sampler.
- **Natural environment:** `lantern-constellation-completes`; technical biome `crowned`; motivated remembered light.
- **Meaningful interactions:** `epilogue.constellation.enter` (scene-enter); `epilogue.reverse-light-started` (scene-enter); `epilogue.reverse-light-complete` (sequence-complete); `epilogue.constellation-seen` (stillness).
- **Persistent environmental consequences:** `type=world-flag, flagId=story-events.started`; `type=object-state, objectId=epilogue.reverse-light, state=running`; `type=object-state, objectId=epilogue.reverse-light, state=complete`; `type=object-state, objectId=epilogue.constellation, state=witnessed`.
- **Exact approved text:** [fragment-046](../src/data/slipperArchiveSource.ts#L1534) (keystone), [fragment-045](../src/data/slipperArchiveSource.ts#L1501) (echo), [fragment-033](../src/data/slipperArchiveSource.ts#L1194) (echo), [fragment-047](../src/data/slipperArchiveSource.ts#L1558) (echo).
- **Revisit:** Apply accepted states above through `StoryObjectPresentation`, chapter state selectors and the existing memory director. Render the place without replaying its input handler or awarding its outcomes.
- **Accessibility equivalent:** The accessible story journey presents the same eligible actions and approved fragments through semantic buttons and the established assisted-attention controls; WebGL is not required.

## Optional Willow Refuge

The approved willow-and-key passage supplies the source context; no new line, chapter, canonical event or inventory item was added. The old willow stands beside a shallow pool at X −53 / Z −320. Its roots follow the terrain. An earth path connects the first woodland to the sanctuary, with a second exit to the meadow. The unclaimed key remains a small visual symbol of agency. Discovery and pausing are optional; none of the 32 scenes depends on visiting this place.

The accessible journey retains the canonical willow/key passage through its existing fragment assignment. The optional scenery adds no exclusive story information or completion requirement.

## Exact-text receipt

| Fragment | Scene | Approved body SHA-256 |
| --- | --- | --- |
| fragment-001 | broken-floor.confession | `ea1e8c271b91d9e2781d4d7792f5b6f8566603e94bfcd9d581655686b74421e6` |
| fragment-002 | broken-floor.confession | `13b328b67bce5267fa465a00d1cbf0e5fd8f5e0ad4a7cf5ed0dc01ae8d2275dd` |
| fragment-008 | enchanted.rabbit-hole | `130a5f2533cdaf555b5bd9087b8ab43c4a17aa9a704cd02c4420af0fc153ee7d` |
| fragment-003 | enchanted.rabbit-hole | `1c30542b42ecc4509b9cc895837032ef3b506ef9b009795a111d7a1e04a3b10a` |
| fragment-010 | enchanted.friendship-meadow | `8690f2d4573c245be783b624b0bb8e45cf29d93cae45f9f47269e12d6bd9a372` |
| fragment-012 | enchanted.friendship-meadow | `6a3e5d0987b0538d6ad10dcb1e32e84c181d3d31d22c15426977ef0e591def30` |
| fragment-006 | enchanted.masked-hearth | `781d6dcfcdd1db5f0ceae8d641399c02b302790e5a325b5d3afd7d85cb366235` |
| fragment-009 | enchanted.masked-hearth | `8f94e1e962852b63028a6d3d85e801ea90dcc0bca39d24410e7669a537386e91` |
| fragment-060 | blue-moon.sanctuary | `2a662575f4a8b58e78f20cdad5709755bafbe62b41ab002a41f0369774e29017` |
| fragment-058 | blue-moon.sanctuary | `bbd156189286764f14df4fec8a73b048520919ec77de6ab41afbd99211b638d7` |
| fragment-049 | blue-moon.sanctuary | `75cc681d507625bcfefd816bb39de5a6317e06a0b64c542e8e825cfe21fbe1cd` |
| fragment-063 | blue-moon.intimacy | `2f8da1f64ac0360a42542f5c38ed23bfd1218ed6e3ef0d34ff04b7bfe3cb75b7` |
| fragment-061 | blue-moon.intimacy | `c508c4eabc875b8bf2c19c8e44a52f153d7931b6ba4a552f32b7c530644ab52c` |
| fragment-023 | blue-moon.intimacy | `35ebbbc3db37698cd02aab81257de829b5a06cf5bb3d347dcab65c3f6b1e9fd1` |
| fragment-062 | blue-moon.caged-bird | `20f56043719f1d25b56f9fc0cdfb5d518403ea862212b88da3c0570702215757` |
| fragment-050 | blue-moon.caged-bird | `aa5bab47b9ac146c6accfe91e09a3e30feca8e8cafeffd6b2efdd76670a1c8b6` |
| fragment-017 | nest.two-hands | `9e015b1afa183d34ca61c6278764ea616e7baad04cf295439db3ad731930022b` |
| fragment-014 | nest.two-hands | `f03a41f3b646dd9460d42da23a35334e9460cec15501842cda7b3afc0108109d` |
| fragment-026 | nest.unsupported-cycle | `02849b602502ba7422f1b14a70ee5bdb874877bf38bac493984bb7bb4b60a2ca` |
| fragment-055 | nest.unsupported-cycle | `66671e5ef0c0e9b68a1a8c9b08d8f8f0b6a6e0462699aed5b1ee10b44065645d` |
| fragment-051 | nest.protection | `3b126fb5d9fd0c858a40a760bf9cc79053b7e749e2eae7c2af24c414997e2736` |
| fragment-011 | sunset.warning-grove | `ffacf44748bc5a430b63b4d95167962aa9436bbd642d43cb976b680ad02fa916` |
| fragment-039 | sunset.warning-grove | `f1856791522e51bd3f4706d00ebc4bc8961f706b2118982549746f8715e84683` |
| fragment-025 | sunset.true-mirror | `c9afcfbb91f6263499b59b9afa3e710f42f41e88e14a13550a9876483ff76dab` |
| fragment-029 | sunset.true-mirror | `c48a491a7d8767f31d69ce852f9ab7080b66e9b334c721ef4705fb8de7ca20c6` |
| fragment-020 | sunset.true-mirror | `42602ddc4dbb027ecbeb1cea8b16a38639043a6c5dc2d5a1a25d300c70d26aa8` |
| fragment-040 | sunset.stillness | `2eb6b520c833f16e02cce9b79eac11d8e4f99a1e45bb54885ae0fe444fda2630` |
| fragment-013 | sunset.stillness | `05bd12fbc1f3d34b21a3c2a6354bee2416a6a3686f8a6af2f539aac9f4aeb844` |
| fragment-005 | thorned.locked-garden | `c04fc67819743a9af58b35063df629d3b5937ae0fb087cfe45576ed687eb093b` |
| fragment-007 | thorned.locked-garden | `2bb07717163806aefa2e11156f5ec41ca50b8e9f66453c79ad1e634d569096cb` |
| fragment-032 | thorned.old-memory-bedroom | `9504f315be66ac45d050aa4285b644bbfa9b423b68f7eb7d537f9db5f75b4ebf` |
| fragment-048 | thorned.old-memory-bedroom | `47d63c690d6924dd14ec2eb2c288fd5d678dfc7c6ada480ef0335f64bd5e9b02` |
| fragment-031 | thorned.old-memory-bedroom | `e116d9ab7af31e50df6e456e781092925c85056bb1beab2d18749eb0271dd4b9` |
| fragment-054 | thorned.self-owned-world | `7a044703d319e8ddf509d8ccdb68825bbe221ac96f10d4892b8be90cf7858b2b` |
| fragment-027 | wolf-swan.false-choice | `43ebd93229dca273969af0ee8fee9d9a7fec06ea9803a2128935851e3c75b289` |
| fragment-021 | wolf-swan.false-choice | `3b732228e5e63662a210d52f24e694699a81ba80a496e7c66ded25dbca099b21` |
| fragment-024 | wolf-swan.false-choice | `f69d9125625ad3d6aa2097d36e3b139aba661e031574fc9d306aec45e3429982` |
| fragment-028 | wolf-swan.convergence | `9d5956335e6b4311e0b85ea558528bb36a959cf864a8df72cf1681cb07702d2f` |
| fragment-064 | wolf-swan.convergence | `6319a2ef595a0edc94050e98c55fcf8852dd62bfabb07df4dbee5724b9173510` |
| fragment-053 | fire.boundary | `d83791d58230b782d236531e74a2495912f210b13980a4b4e5c0996178cd28a2` |
| fragment-004 | fire.boundary | `f75276585d11a0aa6102912924f08d0af14098333a62ea79473452c37a3f8c6f` |
| fragment-041 | fire.boundary | `edda1e28567ab1078038338ae98ec0fa143da0a56c44005f4c408bfaecbdf988` |
| fragment-036 | fire.boundary | `e7c87818c479efb9c3d0a14279d7ff5977ecee9441e9cf9575b687098e0b63de` |
| fragment-034 | river.wash | `fdf169aa1c902af6a9b12860ad67392aee5f8b417a3ead9c89f8c984c77defd8` |
| fragment-052 | river.wash | `f1e3670f63fa611b31e4d0244a76b16c60f187cecff62809c4bcbdc98e93184e` |
| fragment-057 | river.release-surrender | `f245fa28da5c6157685f9f23aa6e1c5da733e2b39468e5719db64c7962fc2c4f` |
| fragment-059 | fork.weighing | `96f6c4db4ef908128d285e0a9d352b766f166677425510bb962da6dec3053232` |
| fragment-037 | fork.weighing | `e1caf66e95272a8d5cb5e92236c83f13baa66c4c1f49b3b4abe17c0f3118a5fa` |
| fragment-018 | fork.four-verbs | `057bb0f1ba289fe67310ad4ec407b5079a71af50a4373a8b50c3e49528aa7513` |
| fragment-016 | fork.four-verbs | `c11195ee70d1ef2e3dc86e521f6ea80e0c2ba0d79965bd36d88c0356054f8c56` |
| fragment-056 | fork.relinquish-hope | `c9a815aaa34ab87633e98e4d0aa39e4b34f67c29804e2295bc0397e22015dacf` |
| fragment-043 | climbs.arrival | `52006d8f4f8ef0e1faa4c969fd1245f86558ad7f27e042a9675237b035d8764c` |
| fragment-015 | climbs.arrival | `0abc00207e6be86bf0ee61fe4237df46968523bae2d684fd981d354932a05a19` |
| fragment-022 | climb.mind | `04fcaddf338b465624381860e56e948ceea6388765efd20a3eefa28ace6257de` |
| fragment-030 | climb.heart | `9d2121f50895aac5bb2bb315f3124b10007fc1d117f9da4b7843b189de0fe886` |
| fragment-066 | climb.womb | `ecf653bce961009f975a52adbf1b7a5cdcd10a82d5762aebdf89944b79bd056d` |
| fragment-042 | climb.womb | `73b0514493560c3558f65ddd340844bc66bc65c50d1e94a519dde9f7d8a44076` |
| fragment-035 | crowned.threshold | `d41510b851be53cd183ec40d713a867f11e43116b48b484615765387b3a9cc45` |
| fragment-065 | crowned.threshold | `c9a815aaa34ab87633e98e4d0aa39e4b34f67c29804e2295bc0397e22015dacf` |
| fragment-038 | crowned.home | `12fce7135bf583c15e8aabbf9cb621aae09b10f988a9defd9df8170e9af7f3ab` |
| fragment-019 | crowned.home | `b1912fdfea53285510b4325733d4c6a21474c44b5372d8de3d1c6005a0d0305a` |
| fragment-044 | crowned.sovereignty | `2ae9775f5ff3fda377e849da210561c193d81839c348d3e7457db11c123400e2` |
| fragment-046 | epilogue.constellation | `0846ab392e13528b37e0cbc90e34877e32be54a27e7cbe2e93ac7537c4a71f0a` |
| fragment-045 | epilogue.constellation | `c9212acecf3e040ddbf7bafa8b41fba1ca670014c5c0ea66b41cc867c6fe4a4b` |
| fragment-033 | epilogue.constellation | `9b598360112df3ff1049f4332bfa01f11fa9cd1decc3033ac535492b50ff3ecb` |
| fragment-047 | epilogue.constellation | `3033b69a32394333b75148c9b06001fd0df6345d035379a12fbf86afaba042df` |
