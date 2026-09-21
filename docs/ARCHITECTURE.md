# Architecture

## Application shell

`src/main.tsx` mounts the React application and the single global experience
settings dialog. `src/App.tsx` coordinates onboarding, the semantic archive,
Forest, focused reading, and Constellation/map state. It owns navigation
actions, but delegates durable state and low-level input.

There is one Three.js/R3F world. Mobile exploration feeds the existing player
and camera; it does not render a second world.

## State ownership

### Journey

`src/stores/useJourneyStore.ts` is the durable journey authority. It stores the
active fragment, ordered history bounded to 512 steps with revisits intact, visited fragments, bookmarks, safe-clearing
recovery information, and cloud-sync status. Sanitization rejects unknown IDs
and repairs invalid persisted snapshots.

Legacy journey storage is read only for migration. Navigation, recovery,
bookmarks, reader progress inputs, map status, and archive availability derive
from the same journey record.

### Experience settings

`src/stores/useSettingsStore.ts` is the authoritative persisted settings
source. It owns render/audio/accessibility preferences and mobile control mode,
handedness, look sensitivity, and optional haptics.

`src/lib/experiencePreferences.ts` provides backwards-compatible focused
getters, setters, selectors, subscription, and settings-dialog open/visibility
APIs. Legacy render-quality, audio, reduced-motion, and onboarding keys are
compatibility mirrors, not additional settings authorities.

### Transient input

`src/stores/usePlayerInputStore.ts` holds only current movement and pending look
deltas. It is deliberately not persisted and is read directly from the render
loop to avoid React rerenders on pointer movement.

`src/lib/mobileControls.ts` contains pure joystick, dead-zone, look-delta, and
viewport-orientation calculations. `MobileExploreControls.tsx` owns pointer
capture and presentation. `StoryScene.tsx` combines transient mobile input with
the existing keyboard/KCC movement and desktop pointer-lock camera.

## Viewport lifecycle

`src/hooks/useMobileViewport.ts` is the single viewport/lifecycle publisher. It:

- uses Visual Viewport dimensions when available;
- publishes mobile and orientation state through a small external store;
- writes root CSS dimensions/data attributes; and
- resets transient input on blur, visibility, page hide, resize, orientation,
  and Visual Viewport interruption.

`src/mobileEnhancements.ts` installs that lifecycle and removes the former
imperative synthetic-keyboard overlay. React owns the visible mobile controls.

## Navigation and content privacy

Guidance resolves a target and passes its world position to existing path,
lantern, and proximity systems. Selecting an unread map/archive item requests
guidance; it does not activate the fragment.

`ArchiveIndex` and `AccessibleArchive` include prose in search and previews only
for visited fragments. Unread entries expose titles and guidance actions so the
map remains useful without revealing unread writing.

## Rendering boundary

`WorldCanvas.tsx` owns the canvas, render-quality setup, physics provider, and
map fallback scene. `StorySceneWithMasterLantern.tsx` preserves the master
lantern/world-director layer around `StoryScene.tsx`.

The existing world finalizer remains part of `prebuild`:

1. `final:world`
2. `content:qa`
3. `world:compile`

Mobile integration must remain localized around input and navigation contracts;
terrain, forest, lighting, path, and finalizer-controlled environment blocks
must not be replaced with historical archive versions.

## Reading, map, and accessibility surfaces

Focused reading is DOM-first and exposes progress, bookmarks, adjacent
fragments, map, archive, and forest actions.

On mobile, the map uses explicit Constellation and Archive tabs. The semantic
archive provides a non-3D route with headings, search, visited-only prose,
keyboard-operable controls, status announcements, and settings access.

The settings surface is one global modal dialog. Native modal behavior plus a
manual focus wrap supplies focus containment, initial focus, Escape close, and
focus restoration. Its open state is visible to App-level keyboard handling.

## Cloudflare boundary

Cloudflare Pages serves the Vite output and optional Pages Functions under
`/api/*`. Functions validate bearer sessions and journey payloads. KV bindings,
the HMAC secret, and optional email sender are deployment configuration; local
journey behavior does not require them.

`wrangler pages functions build` is used as a local/CI compilation check.
Continuous integration has read-only repository permissions and does not
publish Pages or Workers.

## Validation layers

- the project-specific static validator checks mobile contracts and source
  hygiene;
- strict TypeScript covers the application and Pages Functions;
- Node tests cover pure input, recovery, and session/security behavior;
- the production build exercises final-world/content generation and Vite; and
- Playwright runs Chromium, Firefox, WebKit, Pixel-class Chromium, and
  iPhone-class WebKit projects.

Physical Android/iOS qualification remains a separate release activity.
