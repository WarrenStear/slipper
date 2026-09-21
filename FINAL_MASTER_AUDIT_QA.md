# Slipper in the Woods - Final Master Audit QA

Applied scope:

- Build hardening and safer Cloudflare/Vite packaging review.
- Runtime blank-screen risk reduction.
- Local R3F Suspense protection for visual textures and portal previews.
- Navigation and player spawn reliability.
- Rapier terrain and rendered-ground collision alignment.
- Performance tuning for terrain geometry density.
- Lighting floor improvements so the scene does not collapse into full black.
- Audio lifecycle review while preserving the existing gesture-unlock and crossfade engine.

Key source areas:

- src/components/three/StoryScene.tsx
- src/components/three/Portal.tsx
- package.json verification scripts

Main QA notes:

1. Player relocation now uses an entry-aware spawn key so map and portal navigation can reset the kinematic body correctly.
2. Terrain collision is generated from the same procedural height logic as the visual hilly ground.
3. Visual shrines, environment spheres, and portal ghost previews use local fallbacks so asset loading should not blank the full world canvas.
4. Terrain visual density was reduced where appropriate to ease runtime pressure.
5. Ambient and hemisphere lighting now retain a minimum floor while preserving the dark woodland mood.

Verification commands:

```bash
npm ci
npm run typecheck
npm run build
npm run preview
```

Cloudflare Pages:

```text
Framework preset: Vite
Build command: npm run build
Build output directory: dist
Node version: 22
```

Post-deploy QA:

- Enter Explore mode.
- Walk uphill and downhill.
- Confirm the player does not sink through the rendered ground.
- Navigate by portal and map.
- Confirm the player respawns at the active clearing.
- Approach visual portals and confirm the canvas does not blank.
- Test audio unlock and natural fade behaviour.
- Test low, medium, and high quality modes.
