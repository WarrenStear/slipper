# Slipper in the Woods — Phase 9 Emotional Mechanics

This package adds five advanced mechanics that bind player action to story state:

1. **Released Words Constellation**
   - New: `src/components/three/ReleasedWordsConstellation.tsx`
   - Reads `releasedWords` from `useStoryMechanicsStore`.
   - Renders the released words in the final chapter sky as drifting glowing text.

2. **Path-Dependent Final Chapter**
   - Updated: `src/components/three/worldVisualState.ts`
   - Updated: `src/components/three/StoryScene.tsx`
   - Wolf path biases the Crowned Return toward fierce orange/warm fog and lighting.
   - Swan path biases the Crowned Return toward tranquil blue/cool fog and lighting.
   - Final chapter text receives a conditional concluding paragraph unless the entry provides custom `engine3d.pathConclusions`.

3. **Corrupted vs Purified Redactions**
   - Updated: `src/data/slipper3dTypes.ts`
   - Updated: `src/components/three/RedactedText.tsx`
   - `RedactionReveal` now supports `revealedTextWolf`, `revealedTextSwan`, `glowColorWolf`, and `glowColorSwan`.

4. **Somatic Text Pacing**
   - Updated: `src/data/slipper3dTypes.ts`
   - Updated: `src/components/three/StoryScene.tsx`
   - `SlipperEntry` supports entry-level `weight`/`density` and paragraph-level `paragraphMeta`.
   - `TextPacingConfig` supports `paragraphWeights`, `densityMultiplier`, and spacing bounds.
   - Spatial paragraphs are now offset by emotional density, not a fixed interval only.

5. **White Flag Stillness Easter Egg**
   - New: `src/hooks/useIdleTimer.ts`
   - New: `src/components/three/StillnessController.tsx`
   - New: `src/components/three/WhiteFlagSurrenderVerse.tsx`
   - When the player remains still for 30 seconds inside a clearing, the store sets `achievedStillness: true` and reveals the hidden surrender verse beneath the camera.

## Changed / Added Files

- `src/data/slipper3dTypes.ts`
- `src/stores/useStoryMechanicsStore.ts`
- `src/components/three/RedactedText.tsx`
- `src/components/three/worldVisualState.ts`
- `src/components/three/StoryScene.tsx`
- `src/components/three/StoryScene.css`
- `src/components/three/ReleasedWordsConstellation.tsx`
- `src/components/three/StillnessController.tsx`
- `src/components/three/WhiteFlagSurrenderVerse.tsx`
- `src/hooks/useIdleTimer.ts`

## Build

Run locally:

```bash
npm install
npm run build
```

I could not complete a local `npm install`/`npm run build` inside the ChatGPT container because the package install process timed out in this environment. The source patch itself has been applied directly to the project files.
