# World Optimisation Pass — 2026-05-03

This pass stabilises the current Slipper in the Woods runtime before deeper terrain/physics work.

## Applied changes

### 1. Safer build pipeline

`package.json` keeps the normal Cloudflare/Vite build deterministic:

- `prebuild` runs `final:world`, `content:qa`, and `world:compile`.
- `final:world` is an idempotent canonicalizer and audit; canonical source is a
  no-op, while drift is repaired before the build.
- the older source-mutating repair chain is preserved under `repair:world`.
- `qa` remains the full typecheck/build gate.

This keeps production output aligned with the checked-in world contract.
Repair output during a build should be treated as uncommitted source drift and
reviewed before deployment.

### 2. Shared render-quality profile

`WorldCanvas` now owns the render-quality profile and passes it into `StorySceneWithMasterLantern`.

This keeps the canvas DPR, shadows, world director, particles, and lantern on the same quality budget.

### 3. Lighting render-loop cleanup

`WorldLightingRig` no longer allocates new `THREE.Vector3` objects inside `useFrame` for moon/rim target positions. Reused refs are updated in-place instead.

This reduces small but continuous garbage-collection pressure while moving through the 3D world.

## Next terrain/physics phase

The remaining high-impact optimisation is terrain collision parity.

Current state:

- Visual terrain is worker-generated.
- The broad physics floor is still a fixed cuboid fallback.

Recommended next implementation:

1. Export or mirror the worker terrain sampler for runtime collision use.
2. Generate a low-resolution heightfield collider around the player.
3. Keep the flat cuboid only as an emergency fallback below the terrain.
4. Snap/raise spawn positions to sampled terrain height plus player clearance.
5. Rebuild terrain collider chunks only when the player crosses a terrain-cell boundary.
6. Keep visual terrain and collision terrain derived from the same sampler so the player walks over hills instead of through them.

## QA checklist

Run:

```bash
npm run qa
```

Manual smoke test:

- Load `/` on desktop Chrome.
- Switch to walk/explore mode.
- Confirm only one visible lantern/light is carried.
- Walk through clearings and paths.
- Confirm no black-screen fallback appears.
- Confirm cinematic quality can be enabled with `?quality=cinematic`.
- Confirm debug can be shown with `?debug=1`.
