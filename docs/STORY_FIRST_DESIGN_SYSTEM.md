# Story-first gift experience design system

Reference concept: `docs/visual-concepts/story-first/broken-floor-primary.png`

## Product posture

The canonical journey is a story already in motion, not a menu around a 3D application. Interface is allowed only for a deliberate input, accessible reading, audio, settings, saving, or recovery from genuine disorientation. After the dedication, the same visual language expands into the freely explorable woods.

## Visual tokens

| Token | Value | Use |
| --- | --- | --- |
| Ink | `#050708` | page and scene-edge black |
| Charcoal | `#15191b` | wet stone and quiet surfaces |
| Smoke blue | `#657786` | secondary type and mist |
| Moon silver | `#d9e3e8` | primary prose and reflected light |
| Muted teal | `#527884` | water and reflection accents |
| Parchment | `#eee9dd` | warm readable text |
| Lantern amber | `#e9ad62` | the single guidance/accent colour |
| Rose memory | `#a96f78` | rare home and heart detail |

Warm amber should occupy less than five percent of a canonical-journey frame. Panels use transparent ink rather than opaque cards. Borders are hairlines; shadows are deep and diffuse.

## Typography

- Literary display: the existing high-contrast serif stack, uppercase only for the title and selected chapter transitions.
- Prose: readable serif, `clamp(1.05rem, 1.6vw, 1.3rem)`, generous `1.75` line height.
- Controls: quiet sans-serif, no all-caps game labels, no counters.
- Canonical archive text is never rewritten to fit a layout. Presentation adapts to the prose.

## Spatial and responsive rules

- Desktop content width: `min(42rem, calc(100vw - 3rem))`.
- Mobile content width: viewport minus safe-area insets and `1.25rem` on each side.
- Primary action minimum target: `48px`; discreet utility controls remain at least `44px`.
- Keep the centre and lower third available for reflected/diegetic prose.
- During stillness, controls dissolve visually but remain recoverable on pointer, touch, keyboard, or focus.

## Surface hierarchy

1. World and canonical prose.
2. One contextual action, only when the scene requires it.
3. Discreet audio and settings controls.
4. Full reader, opened deliberately.
5. Archive and constellation only after the dedication unlocks Free Woods.

No minimap, compass, percentage, chapter number, fragment total, archive tab, or mode switch is shown in the first or returning journey.

## Motion and sound

- Arrival uses long opacity and environmental handoffs, never a loading screen.
- Reduced motion makes every reveal immediate without removing content.
- Guidance begins as world response; poetic text appears only after sustained inactivity.
- Surrender removes interface, meters, and explanatory timing.
- Silence is an authored state, especially in Broken Floor, Seer, Surrender, Mind, lantern placement, and the constellation handoff.

## Icon inventory

- Sound on / muted: code-native speaker glyph with readable label.
- Settings: code-native text or simple gear glyph with readable label.
- Close / return: typographic button inside overlays only.

No generated icon sheet is required. Controls must stay code-native and accessible.

## Journey states

- Fresh: black, title, subtitle, one `Begin` action.
- Incomplete: the same threshold with one `Continue the Journey` action.
- Completed and dedicated: the same threshold with one `Return to the Woods` action.
- Ending: in-world constellation first, then black dedication, then the only Free Woods unlock action.
