# Slipper in the Woods

A 4D spatial storytelling engine: part poetic archive, part first-person
forest, part persistent memory map.

Built with React, Vite, React Three Fiber, Drei, Rapier Physics, Web Workers,
Zustand, and Cloudflare Pages.

## Repository and production

The active repository is [WarrenStear/slipper](https://github.com/WarrenStear/slipper).
Use `main` for production. The public experience is
[slipperinthewoods.com](https://slipperinthewoods.com).

```bash
git clone https://github.com/WarrenStear/slipper.git
cd slipper
```

GitHub Actions validates changes; Cloudflare Pages builds and deploys the
production branch independently. Earlier validation records retain the repository
and commit identifiers that were current when those reviews were performed.

Check [the live build version](https://slipperinthewoods.com/version.json) to
compare its `revision` with the latest commit on `main`. Each production build
records its Git revision, branch, build time, and source working-tree state automatically
(excluding the regenerated world-state output);
the version document is served without caching. The development server explicitly
reports a development version instead of a historical production date.

## Narrative north star

Slipper in the Woods is a walkable memory archive. The player should feel like
a careful witness moving through a sacred forest where each clearing is a
written fragment, each symbol has emotional meaning, and every journey state
changes the atmosphere.

The experience uses three plain-language modes:

| Mode | Purpose |
|---|---|
| Forest | Explore the physical 3D memory world. |
| Fragment | Read the active archive entry without visual competition. |
| Constellation | Understand the archive as a living memory map. |

The forest supports the writing; it should never overwhelm it.

The [production environment art notes](docs/PRODUCTION_ENVIRONMENT_ART.md) describe
the shared construction toolkit, forest and surface upgrades, chapter application,
quality gates, visual-review commands and remaining production asset work.
The [validation record](docs/PRODUCTION_ART_VALIDATION.md) contains matched
before/after renderer measurements, test results and the limits of the evidence.
The subsequent [production optimization notes](docs/PRODUCTION_OPTIMIZATION.md)
measure terrain CPU savings, smaller geometry buffers and avoided image downloads.

Reviewed replacement art belongs in [public/art/heroes](public/art/heroes/README.md)
and [public/art/materials](public/art/materials/README.md). Their contracts describe
the registry gates, coordinate and material requirements, and review evidence
needed before activation. No reviewed production hero models or material maps are
currently supplied; authored/procedural fallbacks remain active. The legacy
`public/models/` GLBs are placeholders, and `docs/visual-concepts/` is reference
art rather than runtime imagery.

## Current package status

```txt
Performance and asset pipeline — applied
Kinematic movement and portal previews — applied
Zustand and precomputed world state — applied
Cloudflare persistence and magic-link auth — staged/optional
Goal-aligned redesign — applied
Mobile exploration and reading — integrated; physical-device qualification pending
```

Continuous integration validates source, unit/security behavior, the production
build, Pages Functions compilation, and five emulated browser projects. It does
not deploy. Physical Android and iOS qualification remains a release item.

## Quick start

Use Node.js `>=22 <25` and npm `10.9.2`.

```bash
npm ci
npm run dev
```

Complete non-browser check:

```bash
npm run check
```

Production build:

```bash
npm run build
```

Browser qualification:

```bash
npm run test:e2e:setup
npm run test:e2e
```

Deploy to Cloudflare Pages only when deployment is explicitly intended:

```bash
npm run deploy:pages
```

## Repository structure

```txt
functions/                  Cloudflare Pages Functions for persistence/auth
public/                     static assets, models, visuals, cache headers
scripts/                    validation, world compiler, and repair scripts
src/components/three/       R3F scene, portals, player, world canvas
src/components/ui/          reader, map/archive, settings, mobile controls
src/components/auth/        magic-link UI component
src/data/                   story content and generated world state
src/hooks/                  viewport and lifecycle integration
src/lib/                    input math, migration, graph, storage, cloud clients
src/stores/                 journey, world, settings, transient player input
tests/                      Node unit and security tests
e2e/                        Playwright desktop and mobile journeys
docs/                       architecture, mobile, browser, and test guidance
```

## Main commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run Vite locally. |
| `npm run validate` | Check required mobile architecture, tooling, browser projects, and world references. |
| `npm run lint` | Run the checked-in project-specific static source lint. |
| `npm run test:unit` | Run all automatically discovered unit test suites. |
| `npm run test:security` | Run session/payload tests and static security safeguards. |
| `npm run check` | Run all non-browser validation, build, and Pages Functions compilation. |
| `npm run build` | Finalize/precompute world state, typecheck, and build Vite. |
| `npm run test:e2e` | Run all five Playwright projects after `npm run build`. |
| `npm run test:e2e:mobile` | Run Pixel-class Chromium and iPhone-class WebKit projects after building. |
| `npm run wrangler:check` | Compile Pages Functions locally without publishing. |
| `npm run dev:pages` | Build and run Cloudflare Pages Functions locally. |
| `npm run deploy:pages` | Deploy `dist/` to Cloudflare Pages. |
| `npm run typecheck` | TypeScript project check. |
| `npm run assets:compress:wolf` | Compress the wolf GLB with the asset pipeline. |
| `npm run assets:compress:phantom` | Compress the phantom GLB with the asset pipeline. |

## Runtime content pipeline

`npm run prebuild` audits the existing final world, checks the archive,
and compiles the raw archive into `src/data/worldState.json` before each
production build. The app imports that generated world state through
`src/data/slipperContent.ts`; archive migration is not performed in the browser
runtime.

## Mobile exploration and reading

The mobile experience shares the desktop world and journey model:

- analogue movement with a radial dead zone and proportional speed;
- independent drag-to-look input;
- direct and lantern-guided exploration without guidance teleportation;
- left- and right-handed control layouts;
- interruption-safe pointer and viewport reset behavior;
- compact read, map, archive, history, recovery, settings, and threshold actions;
- focused mobile reading with progress and bookmarks;
- Constellation/Archive map tabs with visited-only prose access;
- safe-area, Visual Viewport, portrait, and landscape handling; and
- persisted accessibility and mobile-control preferences.

The semantic archive remains available without walking the 3D world. Unread
fragment prose is excluded from archive search and previews; unread entries
offer guidance instead.

Choose **Continue with text journey** in accessibility settings to follow the
same story and choices without 3D, keeping your current place. Browsers without
WebGL2 use that journey automatically. If a scene or forest worker fails to
load, a keyboard-accessible recovery dialog offers the text journey or a reload.

See:

- `docs/MOBILE.md`
- `docs/BROWSER_SUPPORT.md`
- `docs/TESTING.md`

Playwright mobile projects use emulation. The repository does not claim a
physical-device pass; current Android Chrome and iOS Safari hardware remain
required before production release.

## Goal-aligned redesign

Read `docs/GOAL_ALIGNED_REDESIGN.md` for the current redesign direction.

The core principles are:

- one lantern, one path, one active memory at a time;
- fewer visible systems, stronger emotional clarity;
- calmer movement and cleaner terrain/collision density;
- forest UI that behaves like ritual guidance, not a game HUD;
- reading mode as a first-class experience; and
- constellation mode as a living archive, not a generic menu.

## Architecture

Read `docs/ARCHITECTURE.md` for state ownership, mobile input flow, rendering
boundaries, archive privacy, and validation layers.

## Cloud journey note

Cloud journey persistence is disabled unless the bindings and secrets described
in `wrangler.toml` are configured. The local journey, reader, map, archive, and
mobile controls remain usable without those optional cloud bindings.

The latest renderer integration, scene refinements, quality budgets and remaining art requirements are documented in [Final visual production](docs/FINAL_VISUAL_PRODUCTION.md).
