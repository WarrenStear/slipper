# Slipper in the Woods — Final 4D World

## Build identity

The Cloudflare Pages build audits the checked-in world source. `final:world`
does not rewrite or repair source files. The later `world:compile` step
regenerates `worldState.json` deterministically from the archive; it adds no
wall-clock timestamp by default. Optional `SOURCE_DATE_EPOCH` metadata must use
non-negative integer seconds.

## Terrain rule

The world should resolve to one clean, walkable memory-floor with open clearings, readable ritual paths, and one lantern as the emotional and navigational centre.

## Deployment behaviour

`npm run prebuild` runs:

```bash
npm run final:world && npm run content:qa && npm run world:compile
```

`final:world` audits the required source files, terrain/layout contract, renderer
ownership, and environment budgets. A failed audit stops the build and requires
an intentional source fix. Normal builds do not run the legacy repair scripts.

The old one-shot materialisation workflow has been retired: checked-in source
and the normal build pipeline already provide its required inputs and checks.
CI remains read-only. Its main workflow fingerprints the validated build and
passes that same artifact to browser tests; it does not commit generated source
or create a second build for browser validation.

## Narrative environment principles

- The terrain should feel quiet, clean, and walkable.
- The player should not fight random fragments, duplicate ground layers, or heavy collider noise.
- The forest should frame the story from the edges, not crowd the path.
- Tree crowns should use one irregular clustered canopy per forest layer, keeping
  organic silhouettes without paying for stacked duplicate canopy draw calls.
- The opening view should hold an eye-level path horizon, with restrained mist,
  a terrain-conforming moss trail, firefly guidance, and a single luminous
  memory bloom as a distant landmark.
- One procedural sky dome owns the chapter-aware zenith, horizon haze, and
  quality-scaled cloud field. Low and reduced-effects modes skip cloud noise.
- The photographic valley plate belongs only to the First Wood and feathers
  into a seam-safe panoramic forest plus a single-pass distant silhouette ring.
- The dynamic moon stays neutral at its surface, carries chapter colour in its
  restrained halo, and fades through scene fog instead of reading as a flat UI disc.
- The single lantern remains the centre of movement and attention.
- Narrative entries remain the source of emotional progression through the 4D world.
