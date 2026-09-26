# Production asset delivery

The delivery code is ready for reviewed files; final art and recordings are still
external deliverables. Currently all **13 hero slots, 11 material sets and 10 audio
stems** use authored/procedural fallback. Files, names, concept images and successful
decoding never imply approval. The registries below are the authority; the generated
manifest is an inventory, not a second registry.

## Locked decoder delivery and preflight

Run from the repository root with the supported Node version and locked dependencies:

```sh
npm ci
node scripts/sync-asset-decoders.mjs --check
npm run assets:validate
npm run assets:manifest -- /tmp/sitw-production-assets.json
```

The decoder checker compares five checked-in runtime files byte-for-byte with the
installed, lockfile-selected Three distribution, currently **0.171.0**, checks WASM
headers and licences, and verifies the committed
[decoder manifest](asset-decoder-manifest.json), including byte sizes and SHA-256
hashes. It does not fetch decoder code. Local runtime paths are:

- `/draco/draco_decoder.js`, `/draco/draco_wasm_wrapper.js`, `/draco/draco_decoder.wasm`
- `/basis/basis_transcoder.js`, `/basis/basis_transcoder.wasm`

Only after an intentional Three dependency update, run `npm run assets:sync-decoders`,
review the vendor/manifest diff, and repeat actual compressed/decode-failure browser
tests. Normal validation never rewrites these files. Draco/Basis runtime licences
are Apache-2.0; the separate Three diagnostic image has its own MIT licence.

`assets:validate` rejects invalid approved metadata, missing files, public-directory
escapes, byte-budget violations and invalid GLB/KTX2/audio containers. It uses the
runtime admission helpers and KTX2 preflight. It does **not** replace browser decode,
post-parse model validation, listening or artistic review. `npm run build` runs this
gate through `prebuild`; CI's `npm run check` therefore includes it. Use the normal
build path so `postbuild` preserves `/version.json` identity fields: repository,
revision, branch, builtAt and dirty.

The decoder bytes are version-pinned infrastructure, but their public filenames are
stable: `/draco/*`, `/basis/*`, `/art/*` and `/audio/*` currently **revalidate**, rather
than use immutable HTTP caching. Only hashed `/assets/*` uses immutable caching;
`/version.json` remains `no-store`. Revisioned future art filenames do not change
those header rules automatically.

## Registry contracts

| Registry / admission helper | Required reviewed entry |
| --- | --- |
| [`HERO_ASSETS`](../src/components/three/actors/heroAssetRegistry.ts) / `approvedHeroAsset` | `status: "reviewed-production"`, safe local `/art/heroes/…glb` URL, existing `contract`, and nested `review`. |
| [`MATERIAL_MAPS`](../src/components/three/materials/materialMapRegistry.ts) / `approvedMaterialMaps` | `"reviewed-production"` or `"reviewed-generated"` status (generated approximations counted separately), `maxDimension`, two-axis `repeat`, nonempty `channels`, and flat `provenance`, `licence`, `reviewedBy`, `reviewedAt`. |
| [`PRODUCTION_AUDIO_REGISTRY`](../src/components/three/audio/productionAudioRegistry.ts) / `reviewedProductionAudio` | Reviewed status, local `/audio/…mp3` or `…ogg` URL, matching `format`, `loop`, `nominalLevelDb`, `provenance`, `reviewedBy`, `reviewedAt`. |

**Hero review:** requires `provenance`, `licence`, `reviewedBy`, `revision`,
`maxTriangles`, `maxMaterials`, `maxTextures`, `maxTextureDimension`, and local-metre
`bounds: { min: [x,y,z], max: [x,y,z] }`. Optional fields are `artist`,
`baseY: { value, tolerance }` and `allowSceneLights`. `reviewedAt` is a real UTC ISO
timestamp, such as `2026-09-26T12:00:00Z` or `2026-09-26T12:00:00.000Z`.

Export a self-contained GLB with embedded buffers/images, useful normals/UVs and no
external/data resource URIs. Placeholder metadata and embedded cameras are rejected.
Admission requires exactly one scene and triangle-list, triangle-strip or triangle-fan primitives.
Lighting defaults to forbidden; Lantern lighting stays forbidden even with an
exception. Runtime checks finite transforms, geometry, indices, bounds, budgets,
texture dimensions and required UVs. Imported animations do not play automatically.
Materials and skeleton state are instance-owned clones; shared source geometry and
textures stay cache-owned. Match the slot's existing origin/scale; the loader never
rescales art or adopts imported collision/story ownership. See the
[per-slot hero contracts](../public/art/heroes/README.md), especially housing-only
Lantern, frame-only mirror, separate standing/resting Wolf and the existing bridge
walkway. There is no reviewed `crown` slot.

**Material review:** channels are only `map`, `normalMap`, `roughnessMap`, `aoMap`.
URLs use lowercase local `/art/materials/…ktx2` paths with letters, digits, underscores
and hyphens; no query, fragment or traversal. `repeat` is exactly two positive finite
values up to 32. Optional `offset` is two finite values in −32…32; optional `rotation`
is −2π…2π about UV centre [0.5, 0.5]. Normal maps require
`normalConvention: "opengl"`; AO requires `aoUvChannel: 0 | 1`. `revision` is optional.
Material `reviewedAt` accepts **`YYYY-MM-DD` only**.

Albedo is sRGB; the other channels are non-colour data. Maps use consumer-owned
transform/colour-space clones and `flipY: false`. UV0 must be finite, noncollapsed
and cover every vertex for albedo/normal/roughness. AO independently requires its
declared channel: Three r171 uses `uv` for 0 and **`uv1` for 1**, not legacy `uv2`.
Invalid channels are omitted before program selection; geometry/UVs are never
manufactured. Wetness, wear, damage and reintegration remain in the procedural
material-memory shader. High/cinematic relief without reduced effects may load maps;
low, medium and reduced effects do not. A local detail override cannot bypass that
chapter policy. See the [material contract](../public/art/materials/README.md).

**Audio review:** `alternatives` accepts at most two ordered `{ url, format }`
entries. `loop` may specify `startSeconds`, `endSeconds` and `edgeFadeSeconds`
(default 0.025 seconds; allowed 0.005–0.1). `nominalLevelDb` is −48…0, attenuation
under the current scene mix. `reviewedAt` accepts a real date or canonical UTC
timestamp **with milliseconds**. Audio has no separate licence/revision fields:
include rights/source and export notes in `provenance` and the review record.
See the [audio contract](../public/audio/README.md).

## Budgets and lifecycle

| Delivery | Enforced bounds and ownership |
| --- | --- |
| Hero GLB | 16 MiB input, 15-second network deadline; up to 16 active source entries per renderer. Reviewed budgets must fit hard admission ceilings of 200k triangles, 32 materials, 32 textures and 2048-pixel textures. These are corruption limits, **not targets**: begin near 5k triangles / three materials / 1024-pixel textures for a near character and justify increases with scene evidence. |
| Material KTX2 | 8 MiB input, 15-second network deadline, single 2D image, declared and decoded dimensions ≤1024, bounded mip count; up to 44 shared source maps per renderer. Clones do not edit cached sources. |
| Audio recording | 2 MiB per codec file; mono/stereo, 8–192 kHz, ≤2,000,000 decoded channel samples, all finite PCM, loop ≥100 ms. At most two concurrent fetch/decode operations per context and one cached reviewed loop per stem/context. Each download attempt has a 15-second deadline; non-abortable decode retains its slot until settlement. |

Primary asset requests reject redirects. Optional loading keeps the existing
fallback visible/audible; a failed asset never blocks progression. Heroes/materials
share renderer-specific local decoders (at most two Draco and two Basis workers per
renderer); KTX2 support is detected on that renderer. Leases survive pending parse/
transcode work and release after settlement. Failed material sets release their
consumer lease immediately; sibling work keeps its own cache lifetime. Unmounted
consumers cannot receive late maps/models. Source/cloned-resource disposal owners
must not be mixed.

Reviewed audio is requested only after gesture activation and audible scene demand.
A valid loop replaces the procedural stem through the existing 350 ms audio-clock
crossfade, with current scene gains/filters intact. Mute, settings, visibility,
context interruption and unmount stop both voices and cancel loading; late decode
cannot resurrect playback. SceneLook and Surrender remain the authorities. No lazy
procedural-bank rewrite or production recording is implied by these mechanisms.

## Admission workflow

1. Keep the shipping entry in fallback while collecting source/rights, editable
   originals, export settings, revision and review evidence. Deliver real files into
   `public/art/heroes`, `public/art/materials` or `public/audio`; never promote legacy
   placeholder GLBs, generated diagnostics, procedural buffers or concept PNGs.
2. In an isolated review checkout, propose complete registry metadata and the real
   file. Run asset preflight, the relevant focused tests and technical diagnostics.
   Confirm fallback under missing, invalid, slow and failed decode delivery.
3. Compare fallback and actual admitted art under matched cameras/lights, then in
   its receiving scenes and supported tiers. Check UVs/seams, normal strength, black
   levels, scale, interaction/collision clearance and per-asset render/download cost.
   Audition loop seams, level, codec fallback and Surrender. Capture the actual
   renderer/device; desktop browser emulation does not certify physical phones.
4. Retain evidence, approve the review metadata/status explicitly, generate the
   inventory, and run `npm run check` plus relevant browser/lifecycle checks before
   publishing. Shipping status remains fallback when artistic/device review is absent.

## Development review commands

These tools are outside player UI. Use separate output directories and run GPU
reviews serially. Set `PLAYWRIGHT_BROWSERS_PATH` only if browsers were installed in a
custom location. Default rendering is SwiftShader; `REVIEW_ANGLE=metal` selects
native Metal where supported. Record the backend actually reported.

```sh
# Real hero studio comparison, lit and monochrome, with tier/mobile variants.
REVIEW_HEROES=lantern,mirror,swan,bridge REVIEW_MATRIX=1 \
REVIEW_OUT=/tmp/sitw-hero-review node scripts/review-hero-art.mjs

# Material memory: dry/wet/worn/damaged/reintegrated, matched fallback/reviewed.
REVIEW_MATERIALS=wood REVIEW_MODES=procedural,reviewed REVIEW_MATRIX=1 \
REVIEW_OUT=/tmp/sitw-material-review node scripts/review-material-maps.mjs

# Technical decoder/fallback/StrictMode/two-instance lifecycle diagnostics.
REVIEW_OUT=/tmp/sitw-delivery-review node scripts/review-production-delivery.mjs

# Technical material decode and failure matrix; not final material appearance.
REVIEW_MATERIALS=wood REVIEW_STATES=dry REVIEW_MATRIX=1 \
REVIEW_MODES=diagnostic,diagnostic-missing,diagnostic-invalid,diagnostic-offline,diagnostic-slow \
REVIEW_OUT=/tmp/sitw-material-diagnostics node scripts/review-material-maps.mjs

# Repeat with REVIEW_UV=ao1 or missing-uv to check channel admission explicitly.
REVIEW_MATERIALS=wood REVIEW_STATES=dry REVIEW_MODES=diagnostic REVIEW_UV=ao1 \
REVIEW_OUT=/tmp/sitw-material-ao node scripts/review-material-maps.mjs

# Interactive listening/profile fixture, initially silent; click Enable.
node scripts/audition-audio.mjs --port 4399
# Open http://127.0.0.1:4399/__audio-audition and download its report.

# Audio lifecycle against an already running production preview.
AUDIO_REVIEW_BASE_URL=http://127.0.0.1:4173 \
AUDIO_REVIEW_OUT=/tmp/sitw-audio-lifecycle node scripts/review-audio-lifecycle.mjs
```

Hero studio selectors cover all thirteen slots: `lantern,key,wolf,resting-wolf,swan,mirror,bridge,seer-reflection,roses,lilies,writing-desk,reading-chair,fountain`.
`REVIEW_MATRIX=1` produces 130 fallback captures (13 slots × 5 variants × lit/monochrome);
admitted files add matched production views. Botanical and Seer views use their actual
receiving components. The mirror uses its actual ReflectionDirector with frame replacement
only, retaining the reflection and scar under the tier's bounded reflection policy. Fountain water and reading-nook companion props remain outside
their replaceable slots, with chapter placement cancelled in the studio. These isolated
views complement actual-scene review, which remains necessary for integration.
Hero/material reports explicitly mark production comparisons unavailable when no
entry is admitted. Material `REVIEW_STATES` narrows memory states; `REVIEW_PORT` and
`REVIEW_OUT` isolate review servers/artifacts. `REVIEW_PREPARE_ONLY=1` prepares the
delivery diagnostic without launching its browser, but still builds its temporary
fixture.

The [6,629-byte ETC1S sample](../tests/fixtures/production-delivery/README.md) and
temporary diagnostic GLBs test real local decoders, invalid UVs and lifecycle paths.
They are **not final art**, do not alter shipping registry approval and never enter
the application build; review servers may copy them into temporary output. A colour
diagnostic reused as normal/roughness/AO data is not meaningful artistic evidence.

Final external deliverables remain crafted hero GLBs, calibrated KTX2 material sets,
edited/licensed recordings, matched scene/listening review and physical-device
evidence. No delivery-infrastructure check can supply those craft decisions.
