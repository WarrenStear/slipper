# Ground Environment Upgrade

This phase upgrades the world floor/environment without overwriting the newer player-collision and terrain-probe work already present in the GitHub repo.

## Applied approach

The repo already contains an advanced prebuild chain for object optimisation, lantern control, ground/environment worker upgrades, player collision upgrades, and world-state generation. Instead of replacing `StoryScene.tsx` wholesale, this patch adds a safe build-time surface patch:

- `scripts/upgrade-ground-surface.mjs`
- `package.json` prebuild hook updated to run the new script after `upgrade-ground-environment.mjs`

## What the new surface patch does

- Detects the legacy flat visual ground material in `StoryScene.tsx`.
- Replaces the old unlit `meshBasicMaterial` floor with a lit `meshStandardMaterial`.
- Increases the base ground plane subdivision from `840 x 840 / 1 segment` to `900 x 900 / 10 segments`.
- Adds roughness, subtle emissive response, and opacity preservation so the lantern/environment light can interact with the ground.
- Keeps the latest Rapier KCC/player terrain-probe logic intact.
- Leaves the existing worker-driven terrain/environment upgrade script intact.

## Why this was done as a build-time patch

The current GitHub `StoryScene.tsx` is newer than the downloadable local package and contains later collision/navigation improvements. A direct overwrite would regress the repo. The build-time patch lets the repo keep its latest systems while still upgrading the visible ground layer during deployment.

## Next recommended phase

Move toward a single shared terrain truth across:

- terrain worker height generation
- player ground sampling
- object/tree placement
- visual ground mesh
- Rapier support colliders or heightfields

That will let the player walk over true shaped hills, trails, clearing bowls, and Crowned Return ascents with physics and visuals fully aligned.
