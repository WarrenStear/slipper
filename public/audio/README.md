# Reviewed production audio

No reviewed recordings are currently supplied. All ten active stems remain the
existing deterministic procedural fallbacks: **room, wind, water, fire, glass,
warmth, whisper, birds, cloth and wood**. Do not treat generated buffers or a
filename placed in this directory as production approval.

`src/components/three/audio/productionAudioRegistry.ts` is the admission point.
After listening review, place a compact recording under `/public/audio/` and
change only that stem to `reviewed-production`, with:

- A local `/audio/…` URL and explicit `mp3` or `ogg` format. An ordered alternative
  codec may be supplied (at most two ordered alternatives); MP3 is the broad compatibility option. Local URLs must resolve directly: redirects are rejected. Decode failures
  always leave procedural playback intact.
- A `loop` object, optionally specifying `startSeconds`, `endSeconds`, and
  `edgeFadeSeconds` (default 0.025; allowed 0.005–0.1). Times refer to decoded PCM,
  so review encoder padding as well as the audible seam. The loader trims this
  region and applies a short cosine edge to avoid a discontinuity at the wrap.
- `nominalLevelDb` between -48 and 0, calibrated against the current procedural
  stem at the same scene mix. This is attenuation, not a new scene volume control.
- `provenance`, `reviewedBy` and `reviewedAt`. Record the recording/source,
  ownership or licence, editing/export notes and the listening approval. `reviewedAt` must be a real `YYYY-MM-DD` date or canonical UTC timestamp (`YYYY-MM-DDTHH:mm:ss.sssZ`), not a locale-dependent or rolled-over date.

Prefer short mono loops where spatial information is unnecessary. Stereo is
supported. Each compressed file is limited to 2 MiB and each decoded source to
2,000,000 channel samples (about 8 MB of PCM), at 8–192 kHz. The complete decoded recording must contain finite PCM, including samples outside the selected loop. The loop must span at least 100 ms; validation precedes allocation of its retained copy. Oversized, invalid, missing or
unsupported assets keep the fallback. Huge WAV exports are not accepted.

Files are requested only after gesture-activated playback, when a stem is needed
by the current scene and sound is audible. At most two fetch/decode operations
are in flight. Each codec attempt has a 15-second deadline across its download;
decoding retains its shared slot until it settles. No files are fetched or decoded
by the default registry. A failed
recording is not retried every frame. Successful loops are reused within the
shared AudioContext; each stem keeps at most one cached reviewed loop.

Replacement uses a 350 ms audio-clock crossfade under the existing scene gain and
low-pass mix. A stem briefly owns old/new voices, then disconnects the old source,
filter and gain. The ordinary fallback configuration still owns exactly ten
ambient sources. Muting, opening settings, hiding the page, context suspension/interruption or unmounting aborts
loading and stops both sides of an active crossfade synchronously. A late decode
cannot install a voice after that lifecycle has ended. Surrender, SceneLook
stillness, event audio, reduced-effects scaling and player volume remain owned by
the existing director.

Before approving a recording, review its loop seam, relative loudness and codec
fallback on the supported desktop and mobile browser matrix. Unit tests exercise
the optional loader with test responses; they are not evidence that production
recordings exist or that their acoustic quality has been approved.


## Development audition and browser profile

Run `node scripts/audition-audio.mjs --port 4399`, then open
`http://127.0.0.1:4399/__audio-audition`. This loopback-only development fixture is
outside the production import graph. It starts silent and requires the Enable
button before creating its own context. It does not modify the registry or write
audio files.

- Use **Isolated procedural stem** for each of the ten deterministic fallbacks.
- Use **Isolated reviewed stem** for an admitted recording. An absent or failed
  recording retains the procedural fallback and is identified as such in the
  report; it is never marked reviewed by this tool.
- **Scene mix** uses the actual SceneLook, profile, filters and shared stillness
  helper. Opening reveal, Seer stillness, **Accept Surrender**, and **Restore
  outside air** exercise those acoustic transitions. The fixture selects high
  quality, zero resonance and full domestic compression, and omits event sounds.
- **Hear selected loop wrap** starts an isolated loop 150 ms before its boundary.
  Listen for padding, clicks and changes in tone as well as endpoint continuity.
- Enable a fresh context to measure actual browser allocation of the unchanged
  ten-buffer bank, cache reuse, voice graph setup, first scheduling and first scene
  mix. Download the JSON report before closing the page. Repeat at the intended
  sample rate; this is CPU/scheduling evidence, not speaker latency or a mobile
  device certification.

Pause, hide and dispose stop both sides of replacements. The fixture alone closes
its own contexts when disposed; production continues to preserve the shared
trusted-gesture context. No lazy bank change is made without measured browser
startup benefit. Node tests that replace AudioBuffer with Float32Array storage are
useful for deterministic PCM validation, but are not browser-startup evidence.
