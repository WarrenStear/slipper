# Browser support

## Automated browser matrix

The configured Playwright projects represent:

| Project | Profile |
|---|---|
| `chromium` | Desktop Chrome-class Chromium |
| `firefox` | Desktop Firefox |
| `webkit` | Desktop Safari-class WebKit |
| `mobile-chromium` | Pixel 7-class Android viewport and input profile |
| `mobile-webkit` | iPhone 15-class WebKit viewport and input profile |

These projects validate browser-engine behavior and responsive layouts. Mobile
projects are emulations, not physical devices.

## Runtime capabilities

The application expects a modern browser with:

- ES modules and the APIs required by the Vite production target;
- WebGL for the forest renderer;
- Pointer Events for direct mobile controls;
- `localStorage` for durable local preferences and journey state; and
- standard dialog, focus, and accessibility APIs.

The Visual Viewport API is used when available. Window dimensions are the
fallback. The Vibration API is optional; actions remain complete when it is
missing or denied.

Desktop Forest mode retains keyboard movement and pointer-lock look. Mobile
Forest mode uses pointer-captured analogue movement and a separate drag-to-look
surface. Read, map, settings, onboarding, and the semantic archive use ordinary
DOM controls.

## Degraded and fallback behavior

- A WebGL initialization failure is contained by the canvas error boundary.
  The semantic archive and focused writing access do not depend on walking the
  3D world.
- Storage failures leave the current session usable with in-memory defaults.
- Missing haptic support is silent and never blocks navigation.
- Reduced motion minimizes UI transitions and motion-heavy camera behavior.
- Reduced effects also disables haptic feedback.

Cloud journey sync is optional. When its bindings/secrets are not configured,
the application continues with local journey persistence.

## Physical-device status

The repository does not claim a completed physical-device matrix. Production
qualification still requires current Android Chrome and iOS Safari hardware,
including:

- notched and non-notched safe areas;
- portrait/landscape changes;
- real browser toolbar expansion/collapse;
- interrupted and multi-touch gestures;
- on-screen keyboard overlap;
- VoiceOver/TalkBack navigation;
- sustained WebGL performance; and
- platform-specific haptic support.

Browser automation results and physical-device results must be reported
separately.
