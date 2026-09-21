# Slipper in the Woods — Story Visual Bible

This document turns the storyline reconstruction brief into a restrained,
implementable visual system. The four concept boards are direction references,
not baked game screens. Interface text, interaction state, physics, reflections,
lighting, and chapter transitions remain code-native.

## Core visual idea

Kylie's writing has become a continuous place. Ordinary domestic reality and
the symbolic wood share the same materials: wet timber becomes black water,
cloth becomes a path marker, reflections become rooms, and familiar objects
reappear with changed meaning. The world grows more legible through the
journey; it does not become cleaner by erasing its past.

The visual register is grounded cinematic magical realism. Use darkness,
negative space, silhouette, water, fabric, fire, moonlight, flowers, worn wood,
stone, and restrained symbolic geometry. Avoid fantasy clutter, neon magic,
combat language, horror staging, and arbitrary colour swaps presented as new
chapters.

## Concept boards

1. [Arc I — Broken Floor, Enchanted Wood, Blue Moon](visual-concepts/storyline-v1/arc-1-broken-floor-to-blue-moon.png)
2. [Arc II — Nest, Sunset Seer, Thorned House](visual-concepts/storyline-v1/arc-2-nest-seer-thorned-house.png)
3. [Arc III — Wolf/Swan/Seer, Fire and River, Fork](visual-concepts/storyline-v1/arc-3-integration-fire-river-fork.png)
4. [Arc IV — Three Climbs, Crowned Return, Epilogue](visual-concepts/storyline-v1/arc-4-climbs-crowned-epilogue.png)

## Extracted design system

### Palette

- Foundation: near-black blue, wet charcoal, bark brown, moss, worn stone.
- Warm signal: tarnished amber and candle ivory, never saturated orange bloom.
- Sanctuary: powder blue, moon silver, linen white, restrained blush rose.
- Recognition: burnt sunset orange moving into midnight blue and black water.
- Return: early gold, meadow straw, quiet rose, open blue, and clean shadow.
- Fire and River remain simultaneously legible; neither palette replaces the
  other.

### Light and atmosphere

- One dominant natural or practical source per composition.
- Fog expresses depth and memory, not decoration.
- Moonlight is directional and reflected; lantern light is intimate and local.
- Chapter transitions interpolate existing light and atmosphere.
- Surrender removes visual and audio pressure rather than adding spectacle.

### Composition and scale

- First-person eye line and walkable routes remain obvious without objective
  markers.
- Each scene has one dominant authored landmark.
- Primary geometry forms the interface: floor reflection, bridge, mirror,
  house door, fork, climb, gate, terrace.
- Echoes sit inside landmarks and side routes instead of creating 66 equal
  clearings.
- Dense scenes use foreground enclosure; the return opens the horizon while
  keeping the forest visible behind.

### Materials and motifs

- Wet wood, imperfect plaster, oxidised brass, linen, glass, shallow water,
  river stone, bark, ash, meadow grass, paper, roses, and lilies.
- Repeated motifs change meaning through state: cloth, key, mirror, water,
  lantern, moon, door, birds, Wolf, Swan, and Seer.
- Child presence is conveyed only through safe domestic traces: footprints,
  drawing, toy, handprint, warm light, sound, and a small bed.

### Player-facing interface

- The rendered world is the primary opening and transition surface.
- Forest, Fragment, Constellation, and Settings remain available after the
  Broken Floor inversion.
- Internal terms such as act, Keystone, Echo, objective, unlock, and ritual
  stay out of canonical player-facing copy.
- Stillness is invited through sound and motion reduction; progress feedback
  appears only when its accessibility setting is enabled.

## Implementation inventory

- Broken Floor: bounded room, wet reflective floor, delayed locomotion, forest
  inversion, distant lantern phase.
- Enchanted Wood: warm clearings, flowers, restrained fireflies, distant
  windows, borrowed guidance, Wolf/Swan apparitions.
- Blue Moon: bridge, pond, selective reflection, instanced candles, lilies,
  fabric, roses, swans, beautiful looping route.
- Nest: compact cottage clearing, sunrise grade, domestic trace kit, two-hands
  interaction limits, protection key.
- Sunset Seer: one major cracked mirror, shallow water, reflection proxies,
  stillness-controlled truth and reflected route.
- Thorned House: streamed modular rooms, repeating hall, compression state,
  refill interactions, thorn growth, quiet exit.
- Integration: three natural regions converging on one center; no exclusive
  choice.
- Fire/River/Surrender: simultaneous branch visibility, instanced embers and
  birds, river/fabric route, shared quiet clearing.
- Fork: familiar past and unreadable future, sitting place, four physical
  release actions, lantern ownership transition.
- Three Climbs: one streamed ascent with Mind, Heart, and Womb passages.
- Crowned Return: open terrain, restrained home-castle, quiet gate, reflection
  crown, placed lantern, lightweight look-back landmarks.
- Epilogue: journey-derived constellation and final persistent world state.

## Intentional concept corrections

The concept boards are not literal scene blueprints in three places:

- The Sunset Seer board hints at a distant castle. Production should present
  this only as an ambiguous reflected-future proxy, never as an early reward.
- The Womb climb's shelter must become an abstract protected/created space,
  not a literal bird nest and never anatomical or pregnancy imagery.
- The Blue Moon pavilion and bridge should use the project's own neutral
  timber-and-stone language rather than importing a culturally specific
  architectural style.

No canonical composition contains a waiting partner, reunion reward, or
reconciliation message. The destination remains the protagonist herself.
