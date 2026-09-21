# Slipper in the Woods — Lag Optimization Patch Notes

This package applies a focused performance pass for the Phase 8 lantern build. The goal was to reduce frame spikes and interaction lag without stripping away the core atmosphere of the forest.

## Files changed

- `src/components/three/StoryScene.tsx`
- `src/components/three/renderQuality.ts`
- `src/components/three/WorldCanvas.tsx`
- `src/data/worldState.json` was regenerated with `node scripts/build-world-state.js`

## Main fixes

### 1. Reduced expensive per-frame terrain work

The player controller previously sampled terrain height very frequently during movement. The patch adds a cached/throttled ground probe so the player still follows hills and paths, but terrain sampling no longer runs unnecessarily every frame.

### 2. Faster terrain/path lookup

Maze path segments now include cached bounding boxes. Terrain elevation and nearest-path checks can quickly skip far-away paths instead of evaluating curve distance against every path segment.

### 3. Lower CPU/physics pressure from semantic decorations

Semantic object pathing is now quality-aware:

- Low/medium quality keeps semantic visual instances but avoids mounting heavy physics sensor bodies.
- High/cinematic quality keeps interactivity, but limits the number of active semantic sensors.
- Semantic rebuilds are throttled when the player crosses spatial cells.

### 4. Lighter default quality profile

The app now starts more conservatively on normal hardware:

- Default auto-quality is usually `medium` unless the device has strong CPU/memory headroom.
- Pixel ratio caps are lower to reduce GPU overdraw.
- Tree, decoration, star, particle, and path-mote densities are reduced.
- Lantern shadow casting is reserved for cinematic quality only.

### 5. Canvas/GPU settings improved

`WorldCanvas.tsx` now disables antialiasing at the WebGL context level and allows R3F's performance system to downshift more aggressively during frame drops.

### 6. Removed unnecessary material update churn

Opacity changes no longer force `material.needsUpdate = true` every frame. This avoids extra shader/material invalidation work during traversal.

## Validation performed

Passed:

```bash
node scripts/build-world-state.js
```

Result:

```text
Built src/data/worldState.json with 66 entries and 34 visuals.
```

Not fully completed in the sandbox:

```bash
npm ci
npm run build
```

The dependency install/build could not be completed in this environment because the sandbox had no installed `node_modules` and the install step timed out. Run the normal local/Cloudflare build after extracting the package.

## Recommended next commands

```bash
npm install
npm run build
npm run preview
```

For deployment:

```bash
npm run build
```

Then deploy the generated `dist` folder through your current Cloudflare Pages/GitHub flow.
