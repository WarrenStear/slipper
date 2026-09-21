# Slipper in the Woods — Story Journey Architecture

## Document status

This document describes the story architecture represented by the current source tree, retaining the Storyline Reconstruction contracts and the additive emotional/cinematic event layer. It is an implementation reference, not a deployment, production-readiness, or certification record. The new layer and its acceptance limits are detailed in `CINEMATIC_LIVED_STORY.md`; all 32 source-grounded scene directions are in `EMOTIONAL_CINEMATOGRAPHY_BIBLE.md`.

## Gift philosophy

The experience exists to let the recipient inhabit the emotional and symbolic logic of the original writing. It must feel as though the writing became a place, rather than as though a conventional game borrowed its themes.

The architecture therefore preserves contradiction instead of flattening it into a simple recovery arc:

- beauty and danger may both be true;
- memory may remain sacred without becoming a place to live;
- tenderness and boundaries are complementary capacities;
- leaving does not require erasure;
- sovereignty is integration, not numbness.

The protagonist is the destination of the journey. The canonical story must not steer toward reunion, reward reconciliation, impose a real-person interpretation on symbols, or turn the gift's builder into an in-world objective. Any dedication belongs after completion and outside canonical story progression.

## Sources of truth

Each layer has one responsibility. Renderers and UI components consume authored data; they do not reinterpret the prose or infer core story structure from keywords.

| Concern | Authoritative source | Policy |
| --- | --- | --- |
| Highest creative authority | Supplied raw WhatsApp writing and 34 original source images | The export is a collation, not autobiographical chronology. Do not copy private source into the repository, invent missing lines, or supersede the source with this interpretation. |
| Canonical archive prose and visual references | `src/data/slipperArchiveSource.ts` | Preserve the 66 shipped fragments verbatim, including supplemental archive prose absent from the supplied export. Private redactions remain protected. |
| Compiled runtime content | `src/data/worldState.json`, consumed through `src/data/slipperContent.ts` | Generated from the archive by `scripts/compile-world-state.js`; do not hand-author narrative meaning here. |
| Player-facing chapters, scenes, and fragment roles | `src/data/journeyNarrative.ts` | Owns the 12-chapter order, 32 scenes, chapter-to-biome mapping, and exactly one context for every fragment. |
| Compatibility beats, rituals, outcomes, and six save phases | `src/data/journeyBlueprint.ts` | Derives six uneven save-compatible phases from the authoritative 12 chapters. It preserves established state IDs without restoring an equal 6×11 story partition. |
| Runtime sequencing and gates | `src/lib/journeyProgression.ts` | Pure state predicates determine scene readiness, ritual readiness, and the next required scene or entry. |
| Authored physical geography | `src/data/journeyWorldLayout.ts` | Serializable coordinates, bounds, gateways, primary-route segments, tree exclusions, and Echo spurs. Core geography must not depend on procedural maze output or Three.js. |
| Persistent journey state | `src/lib/storyJourneyState.ts` and `src/stores/useJourneyStore.ts` | Versioned, sanitized, allowlisted story facts and actions. |
| Physical events and story objects | `src/storyEvents/` | Deterministic scene-local prerequisites, input, bounded carrying, exclusive choices and durable consequences; never derive events from prose keywords. |
| Emotional film direction | `src/cinematics/` and `src/components/three/cinematics/` | Blend authored profiles/cues with player input priority, reduced-motion equivalence and bounded effects. |
| Presentation | `src/components/three/chapters/`, `JourneySceneDirector.tsx`, audio, world-memory, and constellation components | Project story state into bounded visuals and sound without becoming new narrative authorities. |

The main data flow is:

```text
archive source ──compile──> runtime content
      │
      └──> narrative catalogue ──> progression rules ──> journey store
                                           │                 │
authored world layout ──────────────────────┼─────────────────┤
                                           ▼                 ▼
                              scene / audio / memory     local + cloud save
                                           │
                                           └──> living constellation
```

The blueprint validators protect the boundary: 12 ordered chapters, 32 ordered scenes, 66 unique fragment assignments, a single Keystone per scene, canonical anchors, and a continuous next-scene chain.

## Narrative chapters and technical biomes

Narrative chapter and renderer biome are intentionally different concepts. The player moves through 12 emotionally distinct chapters, while the renderer reuses six technical biome families. Distinction comes from authored geometry, atmosphere, landmarks, cues, state, and sound rather than twelve separate rendering engines.

| Order | Narrative chapter | Technical biome | Authored scenes | Primary gate or consequence |
| ---: | --- | --- | --- | --- |
| 1 | Prologue — The Broken Floor | `firstWood` | `broken-floor.confession` | Witness the opening confession, then accept the lantern. A fresh journey does not begin with a carried lantern. |
| 2 | The Enchanted Wood | `firstWood` | `enchanted.rabbit-hole`, `enchanted.friendship-meadow`, `enchanted.masked-hearth` | Scenes awaken in order; warmth and contradiction share the same wood. |
| 3 | The Blue Moon Sanctuary | `archive` | `blue-moon.sanctuary`, `blue-moon.intimacy`, `blue-moon.caged-bird` | Candle, water, Swan, flowers, and door actions precede `ritual.accept-memory`; beauty is carried forward without preserving the loop. |
| 4 | The Nest | `firstWood` | `nest.two-hands`, `nest.unsupported-cycle`, `nest.protection` | Two-hand care, named unsupported weight, deliberate release, and acknowledged protection resolve sequentially. |
| 5 | The Sunset Seer | `mirror` | `sunset.warning-grove`, `sunset.true-mirror`, `sunset.stillness` | `ritual.witness-mirror` requires stillness and makes reflection truth and the reflected route persistent facts. |
| 6 | The Thorned House | `thorned` | `thorned.locked-garden`, `thorned.old-memory-bedroom`, `thorned.self-owned-world` | The player clears space, witnesses it refill, stops rearranging the past, recovers self-permission, and physically leaves. |
| 7 | Wolf, Swan & Seer | `mirror` | `wolf-swan.false-choice`, `wolf-swan.convergence` | Swan, Wolf, and Seer each prove insufficient alone before the convergence requires all three; no capacity is excluded. |
| 8 | Fire and River | `fireRiver` | `fire.boundary`, `river.wash`, `river.release-surrender` | Boundary burn precedes washing; release precedes surrender. Completion records ash, clear water, departed birds, released words, and the white flag. |
| 9 | The Fork in the Woods | `firstWood` | `fork.weighing`, `fork.four-verbs`, `fork.relinquish-hope` | Stillness precedes the four embodied verbs; old hope is relinquished before the player deliberately takes ownership of the lantern. |
| 10 | The Three Climbs | `crowned` | `climbs.arrival`, `climb.mind`, `climb.heart`, `climb.womb` | Mind requires onward movement; Heart and Womb persist the player's chosen memory and chosen future. |
| 11 | The Crowned Return | `crowned` | `crowned.threshold`, `crowned.home`, `crowned.sovereignty` | The gate recognises protection, self-permission, chosen memory and future, surrender, and owned light. Lantern placement resolves sovereignty. |
| 12 | Epilogue — The Lanterns Left Along the Way | `crowned` | `epilogue.constellation` | The travelled world and witnessed-memory constellation assemble around the returned self; the lantern burns beside her rather than in her hand. |

The compatibility mapping remains useful for terrain, legacy saves, and established world systems:

| Technical region | Narrative chapters currently using it |
| --- | --- |
| First Wood | Broken Floor, Enchanted Wood, Nest, Fork |
| Mirror | Sunset Seer, Wolf/Swan/Seer |
| Thorned | Thorned House |
| Archive | Blue Moon Sanctuary |
| Fire/River | Fire and River |
| Crowned | Three Climbs, Crowned Return, Lantern Epilogue |

Legacy act IDs now describe uneven save phases whose entry counts follow the authored chapters: Broken Floor + Enchanted Wood (8), Blue Moon + Nest (13), Sunset Seer + Thorned House (13), Wolf/Swan/Seer (5), Fire/River + Fork (12), and Three Climbs + Crowned Return + Epilogue (15). These phases are derived from chapter membership and do not define player-facing structure.

## Scene, Keystone, and Echo model

`JourneyScene` is the unit of primary dramatic progression. It carries a stable ID, chapter and biome, semantic role, fragment membership, one Keystone, zero or more Echoes, an environment cue, an audio cue, and an ordered successor.

The 66 fragments are assigned exactly once across the 32 scenes:

- each scene's Keystone is the required dramatic encounter;
- Echoes remain optional and never participate in `canCompleteScene`;
- a scene completes when its Keystone has been witnessed and every ritual bound to that scene has resolved;
- a chapter completes only after all of its scenes complete;
- the next chapter remains dormant until the preceding chapter marker exists;
- completed scenes remain available for revisiting;
- progression reconciliation emits one outcome at a time (`complete-scene`, `complete-chapter`, or `complete-story`) to avoid update cascades.

`JourneyDirector.tsx` connects these pure rules to the Zustand store. It witnesses physically present or deliberately read entries, retains valid legacy rituals for compatibility, advances legacy region beats, and asks the store to reconcile a single narrative outcome on each relevant state change. For an event-driven journey, scene completion also requires its authored story-event groups. It must observe event/object/placement evidence changes, not only old ritual flags. Player-facing copy should describe environmental change rather than expose the terms Keystone, Echo, act, objective, or unlock.

### Additive cinematic event layer

`StoryEventDirector` choreographs immersive interaction separately from progression and the chapter renderers. It dispatches scene entry, spatial/gaze/stillness evidence and object input through `useJourneyStore.dispatchStoryEvent`. The pure reducer validates current scene, prerequisite snapshot, input duration, object and target; authored actions update event/object/placement evidence and compatible ritual/world flags together. Repeat input cannot duplicate a completed consequence. The first and second floor wipes require separate input snapshots.

`AccessibleStoryObjects` consumes the same available events without a canvas. Its semantic verbs provide equivalent carrying, placement, comparison, leaving, washing, release and creation. Attention and reverse-light sequences wait authored time; they do not have completion shortcuts. Legacy action/ritual panels are suppressed while the incomplete event scene is active. Exact canonical prose remains in the witnessed reader.

`StoryMomentInteraction` remains an assistance/legacy surface; it is not the creative authority for the new physical scenes. Event rendering remains bounded to the active authored scene, while persistent world memories remain separate small representations.

### Legacy embodied action compatibility

`journeyPlayerActions.ts` preserves the earlier action model for saved progress and compatibility gates. The new event layer supplies the active interactions in the 32 authored scenes. In the earlier model, actions were ordered within a scene, required its Keystone to have been witnessed, and stored allowlisted world flags or symbolic objects before scene completion. Its vocabulary includes press, hold, simultaneous two-hand hold, measured stillness, movement, turn-and-move, and explicit choice. The following describes those retained legacy adapters, not the fresh journey's object controls.

Authored object targets bind the Blue Moon and Fork verbs, plus the Thorned House departure, to bounded local positions inside their rendered scenes. By default, the action control does not activate until the player approaches its candle path, water edge, Swan, flower table, beautiful door, open house door, weighing stone, path marker, hope veil, or lantern. Assisted input exposes one sequential equivalent for players who cannot use precision 3D navigation; it records the same outcome and never exposes the four Fork verbs as a menu.

- The Nest requires simultaneous Q+E or dual touch, with an intentional accessible two-hand control, before later weight and protection actions can appear.
- The House asks the player to clear one surface, remain still while it refills, refuse further rearrangement, recover self-permission, and cross the exit.
- The Fork presents weighing and the four verbs one at a time; relinquishment precedes the explicit act that records `lantern.owned`.
- Blue Moon requires lighting the candle path, touching water, following the Swan, placing flowers, and opening the beautiful door before the caged-bird memory ritual. The environment answers with a delayed mirror, reflection-only lock, windless extinguished candle, closed door, and looping bridge.
- Wolf/Swan/Seer first lets each single capacity prove insufficient, then requires tenderness, boundary, and discernment to be held together in the convergence ring. No capacity is excluded.
- Mind completes through movement. Heart records one specific memory object, and Womb records one specific future object plus their generic progression facts.

Keyboard-equivalent and accessible movement controls produce the same narrative outcomes rather than bypassing them. Completed pre-action schema-v2 saves infer only terminal generic evidence: they recover lantern ownership and the generic chosen-memory/future objects, but never invent which personal Heart or Womb choice was made.

## Authored geography and scene composition

`journeyWorldLayout.ts` fixes the emotional route in data before any procedural dressing runs. Each scene has a finite anchor, volume, heading, entry gateway, and exit gateway. Thirty-one primary segments connect consecutive scenes. Core scene volumes and route corridors become procedural-tree exclusions, while bounded Echo-spur attachments reserve optional side-space without moving Echoes onto the main route.

`JourneyWorldComposition` is the integration boundary inside the existing canvas. `JourneySceneDirector` selects the chapter component for the active scene. The 66 archive fragments resolve to the authored scene anchors and finite Echo branches before legacy coordinates are considered; composition rebasing now adjusts only the local terrain height. Only one scene renders at full fidelity. The immediately previous and next scenes may render as lightweight silhouettes, so the window is never larger than three scenes.

Chapter components provide distinct, bounded compositions:

- Broken Floor: wet planks, reflective water, enclosed room edges, distant lantern, and forest below the floor;
- Enchanted Wood: rabbit-hole form, friendship meadow, masked hearth, flowers, fireflies, and guided stone paths;
- Blue Moon Sanctuary: water, bridge, moon, candles, lilies, fabric, intimacy frame, and caged-bird contradiction;
- Nest: sunrise woodland, paired supporting hands, a quality-scaled woven nest, cyclical accumulated weight, exhaustion, a closing shelter, and a durable protection key without a literal child model;
- Sunset Seer: shallow water, one dominant mirror, a delayed self-image, reflection-only path and text, past/future layers, a camera-relative apparition, warnings, and distortion that approaches stillness;
- Thorned House: five to seven modular compressed rooms, a narrowing repeated hall, refilled surfaces, locked garden, old-memory bedroom, invasive thorns, key, and a staged forest exit without a chase or enemy;
- Wolf/Swan/Seer: fire-side and water-side spaces converging at one reflective centre rather than a binary fork;
- Fire/River: separate simultaneously visible fire and river routes converge on a dedicated surrender clearing, with boundary flame, ash, water, guardians, black birds, and white fabric;
- Fork: familiar houseward path, unreadable path, central sitting stone, four symbolic objects, and the owned lantern;
- Three Climbs: an arrival split followed by distinct Mind, Heart, and protected-creation spaces;
- Crowned Return: real gate, open terrain, restrained home architecture, crown reflection, roses, and placed lantern;
- Lantern Epilogue: water, moon, lantern field, and constellation overhead.

The procedural forest, terrain, particles, and ambient props remain supporting systems. They may fill around authored volumes but must not determine core dramatic geography.

## Major narrative gates

Runtime gates are state predicates, not arbitrary level locks:

- `isSceneAwake` requires every preceding scene and, at chapter boundaries, the preceding chapter marker.
- `canEnterNarrativeEntry` permits entries only inside an awake scene; Echoes inside that scene remain free.
- `canResolveRitual` requires the canonical scene, its fragment witness, and any authored prerequisite state.
- Fire/River explicitly chains burn → wash → release → surrender.
- Fork requires the release scene and surrender before weighing can begin. It cannot complete until weighing, letting go, declining, bodily departure, deleting the obsolete instruction, relinquishing old hope, and taking ownership of the lantern have all occurred in sequence.
- Three Climbs explicitly chains arrival → Mind → Heart → Womb. Completing Mind requires onward movement; Heart records a chosen memory; Womb requires that memory and the Nest's protection key, then records a chosen future.
- the Crown threshold requires `key.protection`, `key.self-permission`, `memory.chosen-heart`, `creation.chosen-future`, `lantern.owned`, and `ritual.surrender`;
- placing the lantern requires the sovereign fragment, the carried lantern, the key, and surrender.

These rules are pure and deterministic. The store rechecks them before recording scene and chapter completion, so presentation code cannot directly grant progress.

## Master Lantern

The lantern is a single narrative object whose state is projected into seven phases. Phase is derived from durable story evidence rather than persisted separately, preventing a stored phase from drifting away from the journey that earned it.

| Phase | Presence | Narrative function | Principal evidence |
| --- | --- | --- | --- |
| Distant light | distant | Capacity to see exists but is not yet carried. | No lantern inventory and no acceptance ritual. `storyStarted` alone does not advance it. |
| Borrowed light | carried | Guidance still feels external. | The opening acceptance awards the lantern. |
| Unstable light | carried | Contradiction narrows and disturbs sight. | Early chapter progress after the Broken Floor. |
| Recognising light | carried | Truth makes the beam quieter and more coherent. | Sunset Seer-era progress or the mirror ritual. |
| Owned light | carried | Guidance becomes self-owned. | Only the explicit take-lantern action records `lantern.owned`; entering the Fork or surrendering does not grant ownership. |
| Integrated light | carried | Tenderness, boundary, and truth illuminate one route. | Three Climbs and Crowned Return progress. |
| Released light | placed | The capacity remains after the object is set down. | Lantern placement, released crown landmark, completed epilogue, or story completion. |

`MasterPlayerLantern` remains the sole carried lantern renderer. Chapter props may show the distant or placed story object, but they must not create a second carried light. Reduced motion stabilizes flicker and movement; quality profiles bound light and shadow cost.

## Reflection and stillness

Reflection is both a visual system and a persisted causal system:

- the Sunset Seer chapter places dominant mirror and water surfaces rather than a generic portal;
- the mirror ritual uses stillness and records `mirror.reflections-truthful`, `path.reflected-route-visible`, and the mirror landmark state;
- `WorldMemoryDirector` first renders the mirror as displaced, distorted slices, then as a readable cracked surface after witnessing;
- the crack remains visible, so truth does not erase damage;
- scene audio removes pressure during `sunset.stillness`.

The current renderer deliberately avoids a universal planar-reflection pass. `ReflectionDirector` keeps a quality-scaled ring of camera samples for the delayed self-image; only measured player stillness inside the clearing reduces that history to near-zero, settles the GPU distortion, and reveals the final reflected route. A GPU-distorted translucent mirror skin, duplicate past/future layers, changed landmark silhouette, hidden mirrored route and text, and camera-relative second presence create the authored impossible states. `WaterMemoryReflection` repeats the otherwise absent route beneath shallow water. Reduced-effects mode shortens history and lowers geometry counts, while reduced motion resolves delay and surface motion immediately as an accessibility override.

## Chapter audio

`NarrativeAudioDirector` consumes `chapterId`, `sceneId`, blueprint `audioCue`, resonance, released words, and surrender state. It builds seven procedural loop stems—room, wind, water, fire, glass, warmth, and whisper—then crossfades toward a chapter profile inside the render loop.

The mix follows narrative rather than spectacle: room tone and water for Broken Floor, warmth in the Enchanted Wood, water and intimacy around Blue Moon, restrained domestic warmth in the Nest, glass and silence around the Seer, compressed room tone in the Thorned House, counterpoint for the three resonances, simultaneous fire and water, wind through the Fork and Climbs, and wide air with sparse harmony on return. Scene overrides emphasize Fire, River, Stillness, and each climb. Completed surrender deliberately reduces the master mix almost to silence.

Audio begins only after browser permission or a trusted gesture, obeys the saved audio setting and volume, scales with render quality, and remains unmounted outside Explore mode or when audio is disabled. It is intentionally restrained procedural ambience, not cinematic scoring.

## Resonance and world memory

Wolf, Swan, and Seer are hidden capacities, not scores shown to the player. Values are bounded to 0–100 and affect subtle composition: warmth and ember, water and pale forms, glass and discernment, ambient stems, final-room symbols, and constellation intensity. No progression branch permanently excludes another resonance.

`WorldMemoryDirector` consumes rituals, legacy region completion, authored scene/chapter completion, world flags, landmark states, resonance, inventory, released words, and story completion. It renders one bounded consequence landmark at each of the 12 narrative chapter anchors from `journeyWorldLayout.ts`:

| Landmark family | Persistent stages represented now |
| --- | --- |
| Broken Floor | broken water → calm reflection after Crowned Return |
| Enchanted Wood | lantern waiting → lantern carried → readable transformed path |
| Blue Moon Sanctuary | beautiful looping contradiction → beautiful open path; memory remains carried |
| Nest | warm and enclosed → held together → warm with more open space |
| Sunset Seer | distorted → readable and cracked |
| Thorned House | closed and thorned → open and bare → open with later flowers |
| Wolf, Swan & Seer | divided symbols → all three symbols integrated |
| Fire/River | flame → ash → shoots; dark → clear water; birds present → departed; released words rise; surrender raises white fabric |
| Fork | open past path → partially overgrown; uncertain future path → established; lantern guided → owned |
| Three Climbs | each completed climb remains lit in sequence |
| Crowned Return | gate awaiting key → key-recognised; sparse resonance symbols; lantern placed and lit; completed in-world constellation |
| Lantern Epilogue | waiting light → completed constellation |

The system uses explicit ritual and flag evidence first and legacy act completion only as fallback. Geometry and released-word textures are bounded; only the most recent five released words render, disposable GPU resources are cleaned up, and reduced motion makes them static.

## Living constellation

The constellation is a state projection, not a keyword classification of the archive. `buildStoryConstellationModel` consumes actual history, the active fragment, witnessed fragments, completed rituals/scenes/chapters, landmark states, resonance, and released words.

It begins with one dim present point and no invented route. As the journey develops it adds:

- nodes staged as present, travelled, witnessed, ritual-complete, scene-complete, or chapter-complete;
- travel edges derived from the route actually walked, including repeated crossings;
- scene and chapter edges only when their authored structures complete;
- chapter regions around visible fragments;
- intensity shaped by durable narrative state rather than prose regex;
- released-word bloom and landmark-memory influence;
- an accessible list, current-position marker, guidance target, and bounded pan/zoom map.

The completed model contains all 66 fragments and one connected authored route. UI keyboard landmarks are limited to the active and guidance-target nodes to avoid a 66-stop tab sequence; every visible point remains pointer-selectable, and the accompanying list provides explicit controls.

The epilogue also projects the actual witnessed-entry history into the Three.js sky. That in-world route joins the self-owned home, returned protagonist and crown, both recovered keys, placed lit lantern, protected Nest, resting Wolf, Swan on moving water, quiet Seer, ember fire, living river, distant Thorned House, remaining woods, Blue Moon, and visible homeward path. The final coda states “I returned to myself.” Generic shrine, fragment-card, and duplicate ambient-moon presentation are suppressed only in this integrated final scene so the composition remains legible; the archive and reader still retain the canonical fragment.

## Save and recovery model

### Story schema v2

`StoryJourneyState` schema v2 is the meaningful narrative save contract:

- current physical compatibility act and beat;
- current narrative chapter and scene;
- active fragment, ordered journey history bounded to 512 steps while retaining revisits, and visited fragments;
- witnessed fragments and completed rituals;
- world flags and typed landmark states;
- completed authored story-event IDs, bounded story-object states, and authored placement target IDs;
- Wolf, Swan, and Seer resonance;
- lantern, recovered keys, and symbolic objects;
- released words;
- completed legacy acts, narrative scenes, and narrative chapters;
- story start/completion booleans and timestamps;
- an update timestamp.

The chapter and scene stored for a snapshot are re-derived from the allowlisted active-fragment context during sanitization; a supplied payload cannot claim a contradictory location.

### Local persistence

Zustand persists the journey at the stable `sidtw:journey:v3` local-storage key with middleware envelope version 6. The local envelope also retains bookmarks, last safe fragment, and a bounded finite player position. Resetting the journey creates a fresh v2 story, clears navigation extras, and leaves accessibility/control settings in their separate settings store.

Migration behavior is deliberate:

- a fresh or opening-only journey does not receive a lantern;
- unversioned navigation saves with meaningful prior progress receive the minimum recovery lantern needed to preserve the established experience;
- schema v1 is sanitized into v2;
- unknown future schema versions recover safely rather than being interpreted as current data;
- all story IDs and arrays pass client-side allowlists and bounds;
- the additive story-event fields are absent in old snapshots and sanitise safely; known generic progress may recover, but a particular Heart choice, Womb creation or final placement is never invented.

### Cloud persistence

The Cloudflare Pages Functions contract also uses schema v2. A cloud snapshot includes the full meaningful `StoryJourneyState`, including the additive story-event, story-object and placement fields; local-only UI preferences, bookmarks, and exact player coordinates are not part of the cloud story contract. The server validates those new IDs and values against the authored registry rather than accepting arbitrary object maps.

The client verifies a magic link, stores the signed session token locally, loads the newest timestamped cloud snapshot, and saves changes after a 1.5-second debounce. The server:

- requires HMAC-signed bearer sessions with a bounded age;
- stores by normalized subject in `SIDTW_JOURNEY_KV`;
- rejects malformed or unsupported schemas;
- bounds requests to 128 KiB;
- restricts fragments, chapters, scenes, acts, landmark states, numeric resonance, arrays, strings, and record sizes;
- applies the same 512-step history bound as the local sanitizer without deduplicating or reordering revisits;
- marks migrated navigation-only records so hydration preserves existing local ritual and world state;
- returns `no-store` JSON responses.

Full v2 snapshots restore full story state. A legacy navigation-only cloud record is merged conservatively: it cannot erase richer local mechanics, progressed legacy navigation receives only the compatibility state needed to resume, and an opening-only record cannot bypass the lantern ritual. Sync is timestamp-based last-writer-wins; it is not a field-level conflict-resolution protocol.

Cloud capability depends on `SIDTW_JOURNEY_KV`, `SIDTW_MAGIC_KV`, and `MAGIC_LINK_SECRET`. When they are absent, the functions return a clear 503 and the local journey remains the available save path. Source support does not prove those bindings exist in any deployed environment.

## Assisted Stillness and accessibility

Immersive stillness remains the default. The physical event director measures input activity and camera position/orientation inside the active clearing; movement restarts its required duration. The legacy ritual adapter retains its player-position drift check for compatibility.

Assisted Stillness is an explicit persisted setting that defaults off. It exposes intentional stillness for players who cannot maintain precision 3D input. The semantic journey also offers intentional stillness and a leave/cancel control, waiting the authored duration. Default physical stillness has no task countdown.

When WebGL cannot be created, or when `?accessible=1` is requested, the fallback onboarding opens a canvas-free canonical text journey rather than a dead-end archive. `AccessibleStoryJourney` consumes the same Zustand journey, progression predicates, event/object catalogue and compatible ritual outcomes as the 3D director. Each physical input becomes an explicit semantic control, while Heart and Womb retain their authored choices. Unwitnessed prose is not mounted in either the text journey or semantic archive; only titles and route context remain available until the player chooses to witness a memory. The text route can complete all 32 required scenes, persists through the same local/cloud snapshot path, and leaves all 34 Echoes available as optional memories.

Related accessibility contracts include:

- reduced motion stabilizes flicker, cloth, particles, released words, and transition timing;
- reduced effects removes optional particles, weather, bloom proxies, high-cost detail, and haptics;
- high contrast and text scaling are applied at the document root;
- settings use focus management, labelled controls, pressed states, and live status regions;
- hold interactions have an intentional one-action keyboard equivalent;
- mobile control mode, side, look sensitivity, safe areas, and return-to-clearing recovery remain separate from story state.

Accessibility settings alter the means of completing an action, never its narrative meaning or outcome.

## Performance and render-window strategy

The architecture controls cost structurally before reducing visual quality:

1. Exactly one authored scene renders at full fidelity; at most two adjacent scenes render as low-detail proxies.
2. Persistent landmark memory is a separate bounded layer and is never promoted into another full scene render.
3. Trees and candles use instanced meshes; repeated decorative counts are quality-capped.
4. Chapter components and reusable primitives are memoized, while static layout catalogues and lookup maps live at module scope.
5. Low, Medium, High, and Cinematic profiles cap forest radius, instance density, particles, decoration, shadow maps, and device-pixel ratio.
6. Reduced Effects forces zero optional particles and weather, removes ground detail and bloom proxies, and disables shadows.
7. Narrative render scaling may soften DPR under memory pressure and restore a small amount of clarity as the world resolves, within hard limits.
8. Audio uses seven reusable looping buffers and smooth volume interpolation rather than spawning cue sounds every frame.
9. Authored coordinates and tree-exclusion volumes prevent procedural clutter from blocking important paths or forcing expensive corrective geometry.
10. The constellation is lazy-loaded with the map surface, and GPU-backed textures/geometries created by world-memory effects are explicitly disposed.

These are budget mechanisms, not measured performance claims. Frame-time, memory, mobile thermals, and browser-specific behavior still require representative-device testing.

## Validation and release boundaries

The principal automated contracts are distributed across:

- `tests/world-content.test.mjs` — 66 compiled entries, valid assets, and narrative-coordinate precedence;
- `tests/journey-blueprint.test.mjs` — frozen canonical-source hash, uneven compatibility-phase integrity, and ritual/outcome references;
- `tests/journey-progression.test.mjs` — 32-scene linear progression, optional Echoes, special gates, and story reconciliation;
- `tests/journey-actions.test.mjs` — action allowlists, causal order, physical/choice outcomes, and action-to-scene completion gates;
- `tests/journey-world-layout.test.mjs` — authored anchors, gateways, route, exclusions, Echo spurs, and three-scene render window;
- `tests/world-topology.test.mjs` — 32-scene ground spine, 34 finite Echo branches, chapter thresholds, and the final ascent;
- `tests/lantern-narrative.test.mjs` — seven phases and fresh-story lantern boundary;
- `tests/narrative-audio.test.mjs` — all chapter profiles, resonance influence, and surrender silence;
- `tests/constellation-story.test.mjs` — actual-route projection and completed 66-node connected model;
- `tests/journey-recovery.test.mjs` — local/cloud migration, recovery, sanitization, reset, and navigation accessibility guards;
- `tests/assisted-stillness.test.mjs` — persisted opt-in and intentional control;
- `tests/accessible-journey.test.mjs` — deterministic no-WebGL routing, canonical state gates, explicit choices, and witnessed-prose boundaries;
- `tests/session-security.test.mjs` — server bounds, legacy cloud migration, and signed-session tamper rejection;
- `tests/world-render-contracts.test.mjs` — renderer ownership, world-memory stages, final tableau composition, and bounded render behavior.
- `e2e/story-journey.spec.ts` — rendered Broken Floor entry, fallback onboarding, every chapter boundary, causal gates, seven lantern phases, the completed constellation, and a clean-state representative journey driven through production UI controls.
- `e2e/accessible-journey.spec.ts` — clean-state no-WebGL traversal of all 32 canonical scenes, including explicit Heart/Womb choices and proof that prose remains absent before witnessing.
- `e2e/cinematic-story-gameplay.spec.ts` — fresh production semantic object controls through all 32 scenes, material consequence/choice assertions, reverse-light ordering and persisted reload. A passing semantic run is not proof of physical discoverability or visual quality.

The aggregate `npm run test:unit` includes the focused story suites. `npm run check` covers content QA, client and Pages Functions typechecks, unit and security suites, the production build, and Pages Functions bundling. The canonical journey Playwright specification now exercises the rendered UI through the production persistence envelope; the full five-browser/device project matrix remains a separate release qualification.

Current implementation boundaries that must not be overstated:

- direct navigation and the bulk physical-entry lock list both use the complete schema-v2 store and the 12-chapter predicates; the six-act gate remains only as migration compatibility for incomplete legacy callers;
- the flagship mirror behaviors are quality-bounded custom proxies rather than a general-purpose reflection engine, so unrelated surfaces do not incur extra scene passes;
- the Nest protection key, Fork action flags, lantern ownership, generic chosen memory, and generic chosen future are restored into older progressed snapshots; specific Heart and Womb choices remain unknowable and are not fabricated;
- persistent `WorldMemoryDirector` landmarks are deliberately small symbolic memories at the 12 authored anchors; they do not re-render entire completed chapter environments;
- cloud schema support does not establish KV bindings, successful deployment, cross-device verification, or live recovery;
- no commit, push, CI result, preview, merge, deployment, or production certification is asserted by this document.

## Validation summary

Validation evidence is recorded at handoff rather than frozen here because counts change as the contract suite grows. `npm run check` is the aggregate local gate; the focused canonical Chromium specification separately proves rendered story behavior. Both remain local evidence only: live cloud-binding recovery, protected CI, publication, merge, deployment, and production certification require their own explicit verification.
