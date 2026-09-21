# Mobile experience

The mobile experience uses the same React application, journey state, physics
world, and story graph as desktop. It does not create a second renderer or a
mobile-only copy of the archive.

## Exploration controls

On a coarse pointer or a viewport up to the mobile breakpoint, Forest mode
offers a collapsible control surface with two exploration styles:

- **Direct** uses an analogue joystick with a radial dead zone and proportional
  movement speed. A separate drag surface controls the camera, so walking and
  looking can happen independently.
- **Guided** selects a valid story clearing as the lantern target. Guidance
  changes the visible route and target cues; it does not change the active
  fragment or teleport the player. The player remains responsible for walking.

The movement surface can be placed on the left or right, and touch-look
sensitivity is persisted and clamped to a finite safe range. Desktop keyboard
movement and pointer-lock look remain separate from the transient mobile input
store.

The compact action menu exposes reading, map, archive, previous/next movement,
last-clearing recovery, next-unread guidance, chapter-path guidance, journey
history, settings, and return to the threshold. Actions are disabled when the
current journey cannot supply a valid target.

## Interrupted-input recovery

Transient movement and look values reset when:

- a pointer is cancelled or loses capture;
- the browser window loses focus;
- the document becomes hidden;
- the page is hidden or discarded;
- orientation or viewport dimensions change; or
- the Visual Viewport resizes or scrolls as browser chrome changes.

Controls also release pointer capture and reset on unmount, handedness changes,
and direct/guided mode changes. No touch state is persisted as journey data.

## Reading and map

Focused reading mode provides:

- progress for the active fragment;
- previous and next fragment actions;
- bookmark toggling;
- return to the forest;
- map and archive access; and
- mobile-safe bottom controls and text scaling.

On mobile, Map mode presents **Constellation** and **Archive** as explicit tabs.
Visited fragments can be reopened. Unread fragments expose their title and a
guidance action, but not their prose. Search includes prose only for visited
fragments.

The semantic archive remains usable without navigating the 3D world. It uses
ordinary headings, lists, buttons, search, status text, and visible focus
states.

## Viewport and layout

`useMobileViewport` reads the Visual Viewport when available and otherwise uses
the window dimensions. It publishes current dimensions and portrait/landscape
state as root CSS data and custom properties.

Mobile CSS accounts for safe-area insets, dynamic viewport height, browser
chrome, portrait and landscape layouts, touch target sizing, overscroll
containment, and scrollable reading/settings surfaces.

## Preferences and accessibility

One persisted settings record controls:

- direct or guided exploration;
- left- or right-handed control placement;
- touch-look sensitivity;
- optional gentle haptics;
- reduced motion and reduced environmental effects;
- contrast, text scale, and reading surface;
- render quality; and
- audio enablement and volume.

Existing render-quality, audio, reduced-motion, and onboarding keys are migrated
and mirrored for older runtime consumers. The unified settings record remains
authoritative. Haptics are forced off while reduced effects is active, are never
required for an action, and fail silently when the Vibration API is unavailable.

The settings UI is a modal dialog with initial focus, focus containment, Escape
close, focus restoration, and an application-visible open-state signal so
global navigation shortcuts can pause. Restoring settings requires explicit
confirmation and does not erase journey history or visited fragments.

## Release qualification still required

Playwright covers desktop and mobile browser emulation, but emulation is not a
substitute for physical-device testing. Before a production release, qualify at
least one current Android Chrome device and one current iOS Safari device for:

- real browser-chrome and safe-area behavior;
- multi-touch and interrupted gestures;
- orientation changes during movement and reading;
- on-screen keyboard interaction;
- sustained WebGL performance and thermal behavior;
- screen-reader navigation; and
- haptic behavior where the platform supports it.

No physical-device pass is claimed by the repository or CI configuration.
