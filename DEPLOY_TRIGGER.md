# Deploy Trigger

This file triggers the existing Cloudflare Pages deployment from GitHub `main`.

Latest trigger: 2026-09-15 (SAST)

Release source: `aff20dc74b7ab97ff26da183fb06e7560dccd5b7`

The repository owner explicitly requested a live production deployment of the current main build. This deployment-trigger commit intentionally has no build-skip prefix and does not modify application code, story content, assets, dependencies, save schemas, or environment settings.

Included changes:
- Story interactions stay bound to the authored event selected by the player.
- Multi-touch ownership and interruption handling protect physical story gestures.
- Timed story attention pauses when the page is inactive.
- Reverse-memory lighting follows the story director's playback clock.
- Runtime regression tests cover these interaction and timing safeguards.

Validation observed before this deployment trigger:
- Source, unit, security, production build, and Pages Functions CI: passed.
- Cross-browser gameplay CI: still running; no completed result claimed.

This trigger records the deployment request, not a successful deployment. Confirm the Cloudflare Pages check and the production site before reporting the release as live.
