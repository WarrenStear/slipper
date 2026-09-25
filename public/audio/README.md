# Reviewed production audio

No reviewed recordings are currently supplied. All ten active stems remain the
existing deterministic procedural fallbacks: **room, wind, water, fire, glass,
warmth, whisper, birds, cloth and wood**. Do not treat generated buffers or a
filename placed in this directory as production approval.

`src/components/three/audio/productionAudioRegistry.ts` is the admission point.
After listening review, place a compact recording under `/public/audio/` and
change only that stem to `reviewed-production`, with:

- A local `/audio/…` URL and explicit `mp3` or `ogg` format. An ordered alternative
  codec may be supplied; MP3 is the broad compatibility option. Decode failures
  always leave procedural playback intact.
- A `loop` object, optionally specifying `startSeconds`, `endSeconds`, and
  `edgeFadeSeconds` (default 0.025; allowed 0.005–0.1). Times refer to decoded PCM,
  so review encoder padding as well as the audible seam. The loader trims this
  region and applies a short cosine edge to avoid a discontinuity at the wrap.
- `nominalLevelDb` between -48 and 0, calibrated against the current procedural
  stem at the same scene mix. This is attenuation, not a new scene volume control.
- `provenance`, `reviewedBy` and `reviewedAt`. Record the recording/source,
  ownership or licence, editing/export notes and the listening approval.

Prefer short mono loops where spatial information is unnecessary. Stereo is
supported. Each compressed file is limited to 2 MiB and each decoded source to
2,000,000 channel samples (about 8 MB of PCM). Oversized, invalid, missing or
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
ambient sources. Muting, opening settings, hiding the page or unmounting aborts
loading and stops both sides of an active crossfade synchronously. A late decode
cannot install a voice after that lifecycle has ended. Surrender, SceneLook
stillness, event audio, reduced-effects scaling and player volume remain owned by
the existing director.

Before approving a recording, review its loop seam, relative loudness and codec
fallback on the supported desktop and mobile browser matrix. Unit tests exercise
the optional loader with test responses; they are not evidence that production
recordings exist or that their acoustic quality has been approved.
