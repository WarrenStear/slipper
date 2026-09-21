# Slipper in the Woods — Goal-Aligned Redesign

## North star

Slipper in the Woods is a walkable memory archive. The player should feel like a careful witness moving through a sacred forest where each clearing is a written fragment, each symbol has emotional meaning, and every journey state changes the atmosphere.

The redesign therefore prioritises:

- fewer visible systems, stronger emotional clarity
- one lantern, one path, one active memory at a time
- a quieter interface that behaves like ritual guidance rather than a game HUD
- a forest that is easier to walk through and harder to get stuck inside
- emotional state made visible through subtle weather and meters, not noisy panels
- map mode framed as a living constellation, not a generic menu

## Product experience model

The app now has three user-facing modes:

| Mode | User-facing label | Purpose |
|---|---|---|
| `explore` | Forest | Walk/orbit the 3D world and physically approach memory clearings. |
| `read` | Fragment | Read the active archive entry without visual competition. |
| `map` | Constellation | Understand the archive shape and move intentionally between remembered nodes. |

The design avoids treating the project like a dashboard or standard game. It now reads as a poetic spatial archive with a ritual topbar, emotional weather panel, chapter rail, and focused reader.

## UI redesign

### Removed / reduced

- heavy multi-panel dashboard feeling
- duplicated progress panels in the main explore state
- overly technical mode naming
- noisy portal/status language
- excessive object density fighting the writing

### Added / strengthened

- `ritual-topbar`: single primary command layer with current memory, chapter, mode switch, and journey controls
- `goal-guidance-panel`: narrative cue that explains the emotional axis of the current clearing
- `memory-axis-panel`: compact emotional weather display for memory pressure, depth, symbolic weight, and fire/water balance
- `current-clearing-card`: simple status of the active clearing and next action
- `chapter-ritual-rail`: horizontal chapter progress rail built around the current chapter
- `map-intent-panel`: explains constellation mode as a living archive rather than a menu
- `ritual-reader-panel`: calmer reading mode with stronger typography and less distraction

## World redesign

The forest generation and navigation constants were changed to make the world less cluttered, less mountainous/random-feeling, and more walkable.

| Area | Change |
|---|---|
| Player speed | Reduced from `5.0` to `4.25` for slower, more deliberate movement. |
| Tree density | Reduced from `5` trees/cell to `3` trees/cell. |
| Decorative density | Reduced from `2` decorations/cell to `1` decoration/cell. |
| Clearing radius | Increased from `5.2` to `7.4` so story nodes feel like readable rooms. |
| Corridor width | Increased from `3.7` to `5.2`; minimum corridor from `1.55` to `2.8`. |
| Tree colliders | Reduced from `96` to `64` to lower collision clutter. |
| Approach radius | Increased from `9.5` to `11.5` so clearings wake sooner and feel less finicky. |
| Node visibility | Increased story/gateway visibility ranges to make the world easier to interpret. |

Chapter directors were also retuned. Forest/object/particle densities were lowered across chapters while path clarity was raised. The goal is a calmer world with stronger symbolic landmarks and fewer random obstacles.

## Design language

The new UI theme is based on:

- warm moonlit parchment text
- glassy dark panels with soft gold edges
- serif titles for sacred/archive language
- restrained progress meters
- minimal but meaningful glyphs per chapter
- responsive mobile layouts that hide secondary panels first

## Acceptance criteria

The redesigned project should feel successful when:

1. The user immediately understands: **Forest / Fragment / Constellation**.
2. Explore mode feels quiet and sacred, not dashboard-heavy.
3. The player can walk with less object collision and less visual noise.
4. Reading mode is comfortable and primary, not an afterthought.
5. The constellation explains the story shape without replacing physical exploration.
6. Every UI element answers: “Where am I, what am I feeling, what can I do next?”

## Files changed

- `src/App.tsx`
- `src/styles.css`
- `src/components/three/StoryScene.tsx`
- `src/components/three/chapterDirector.ts`
- `docs/GOAL_ALIGNED_REDESIGN.md`

## Validation notes

`node scripts/build-world-state.js` was run successfully after the redesign and rebuilt `src/data/worldState.json` with 66 entries and 34 visuals.

A full `npm run build` requires the project dependencies to be installed locally with `npm install` or `npm ci`. In this sandbox, dependency installation was not completed, so the full TypeScript/Vite build could not be completed here.
