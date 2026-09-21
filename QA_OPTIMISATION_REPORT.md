# QA Optimisation Report

## Status

Cleaned and patched on 2026-05-01.

The optimized `StoryScene.tsx` is now the active runtime file imported by `WorldCanvas.tsx`.

## Applied fixes

### 1. NPC Suspense freeze prevention

- Added proactive `useGLTF.preload()` calls for `/models/wolf.glb`, `/models/phantom.glb`, and `/models/swan.glb`.
- Wrapped `NPCEncounterModel` in a local `<Suspense>` boundary.
- Uses `ProceduralNPCFallback` while an NPC model is loading, preventing the full world canvas from falling back to the global loading screen.

### 2. Garbage-collection stutter reduction

- Refactored `ContinuousForestBed` frame checks from generated string keys to primitive ref-object comparisons.
- Refactored `SemanticObjectPathing` frame checks from generated string keys to primitive ref-object comparisons.
- This avoids per-frame array/string allocation in hot render loops.

### 3. Dynamic moon shadow bounds

- Added a dedicated moon target object.
- The moon light and target now follow the camera while preserving the narrative light angle.
- Tightened shadow camera bounds from a large static world box to a local 24x24 player-centered box: near `0.5`, far `40`, left/right/top/bottom `-12 / 12`.

### 4. Source tree cleanup

Moved old active-source-risk files to `docs/project-history/storyscene-cleanup/`:

- `StoryScene.original.tsx`
- `StoryScene.black-screen-fix.tsx`
- `storyscene-performance-optimizations.patch`

Removed from the active source/package root:

- `StoryScene.optimized.tsx` duplicate after activation
- temporary files `sedKffBEK` and `XX4Cc88y`
- `tsconfig.tsbuildinfo`
- `tsconfig.node.tsbuildinfo`
- `vite.config.js`
- `vite.config.d.ts`

Added `.gitignore`, `.env.example`, `CHANGELOG.md`, and `CONTRIBUTING.md`.

## Verification commands

```bash
npm ci
npm run typecheck
npm run typecheck:functions
npm run build
```

## Notes

The project intentionally keeps phase implementation examples under `docs/phases/`. These are documentation artifacts and not part of the active runtime source tree.
