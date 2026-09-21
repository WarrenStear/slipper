# World Environment Optimisation Notes

Implemented on `main` for the Slipper in the Woods world/environment pass.

## Intent

Restructure the world feel so it reads less like a jagged mountain field and more like a navigable, cinematic woodland:

- Softer atmosphere.
- Cleaner lighting.
- Less visual clutter.
- Reduced haze and shadow heaviness.
- Better path clarity across chapters.
- More stable lantern/world readability.

## Applied changes

### Lighting and atmosphere

- Increased ambient, directional, and hemisphere lighting floors.
- Raised exposure slightly so the world is not overly black or crushed.
- Reduced fog density across all chapter biomes.
- Reduced vignette and silhouette contrast so the world remains readable.
- Reduced heavy shadow strength so forms are softer and less harsh.

### Environment clarity

- Reduced semantic density, particle intensity, weather intensity, and ground detail intensity.
- Reduced crown/dome opacity so the world feels less visually crowded.
- Increased path clarity and clearing quietness to help navigation.
- Improved lantern reach and stability so movement through the woods feels smoother.

## Important implementation note

The current `main` branch contains a newer, expanded `StoryScene.tsx` and `forestWorker.ts` terrain pipeline. To avoid rolling back newer world systems, this pass intentionally patched the active visual-state system first instead of overwriting large files from an older exported package.

Recommended next terrain-only pass:

- Lower `CROWNED_RETURN_ASCENT_HEIGHT` in `StoryScene.tsx`.
- Reduce broad/mid terrain noise amplitude in both `StoryScene.tsx` and `src/workers/forestWorker.ts`.
- Widen crown ramp blending and reduce crown clearing lift.
- Keep path and clearing flattening stronger than surrounding terrain.
