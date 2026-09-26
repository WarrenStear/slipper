# Reviewed material maps

The `wood`, `wet-wood`, and `bark` entries in `MATERIAL_MAPS` now use two local
**AI-generated material approximations**. They are authored appearance assets,
not photogrammetry or measured PBR scans. Other finishes retain their procedural
fallbacks. The source PNGs, generation records, SHA-256 hashes, dimensions and
encoded byte counts are in [`art-source`](../../../art-source/README.md).

Timber is applied only to construction assemblies with reviewed per-board UVs;
legacy timber meshes keep their procedural finish. Bark is applied to the root
threshold and continuous instanced forest. Albedo is 512px; normal and roughness
are 256px, with complete mip chains. The two sets total **2,328,961 download
bytes** and **4,194,296 decoded RGBA/mip bytes** at source level. KTX2 uses Zstandard
supercompression, not GPU block compression. This estimate excludes renderer,
decoder, driver and duplicate-upload overhead; it is not a device measurement.

Generated normal maps use a restrained `.24` strength. The bark source's green
axis was corrected to OpenGL after directional inspection; oak retained its
original orientation. No AO is added. Material memory still controls local
wetting, wear and damage. Low/medium quality and reduced effects request no maps.


## Admission and delivery contract

Generated approximations use `status: "reviewed-generated"` after source and receiving
mesh review. `status: "reviewed-production"` remains available for separately reviewed
production assets; generated sets do not use it. Both statuses pass the same strict
`approvedMaterialMaps` runtime/manifest admission checks and are counted separately
in the generated manifest. Required metadata is deliberately small:

| Field | Contract |
| --- | --- |
| `channels` | At least one of `map`, `normalMap`, `roughnessMap`, `aoMap`; no other channels. |
| Channel URL | Local `/art/materials/` path ending in `.ktx2`. Lowercase letters, digits, underscores and hyphens in nonempty path segments; no traversal, URL queries, fragments or remote hosts. Prefer revisioned filenames. |
| `maxDimension` | Integer 1–1024. Every decoded width and height must be a positive integer within this declared maximum. |
| `repeat` | Exactly two finite values greater than zero and at most 32, reviewed at actual scene scale. |
| `offset`, `rotation` | Optional finite two-axis offset (−32–32) and rotation (−2π–2π radians, about UV centre [0.5, 0.5]); defaults are zero. |
| `normalConvention` | Required as `"opengl"` when a normal map exists. Convert and review DirectX maps before delivery; the runtime does not silently invert normals. |
| `aoUvChannel` | Required as 0 or 1 when AO exists. Three r171 channel 0 means geometry `uv`; channel 1 means geometry `uv1` (not the legacy `uv2` name). |
| `provenance`, `licence` | Nonempty source/artist/source-record reference and permission/licence summary. Keep the full source record alongside editable art. |
| `reviewedBy`, `reviewedAt` | Reviewer and valid `YYYY-MM-DD` review date. Filename alone never grants approval. |
| `revision` | Optional nonempty revision identifier; recommended for connecting screenshots and source exports. |

Albedo uses sRGB. Normal, roughness and AO are non-colour data. Consumer clones
own transforms, channel selection and colour space; loading-cache sources are
never edited. KTX2 uploads use `flipY: false`. The maximum source-cache population
is 44 textures (eleven slots × four useful channels).
Primary requests use same-origin fetch with redirects rejected, a 15-second
network timeout and an 8 MiB streaming byte cap. KTX2 header dimensions, mip count
and single-2D-image topology are checked before transcoding; array/cube/volume
textures are outside this surface-map contract.

## UV safety and material memory

Albedo, normal and roughness use UV0. Before Three chooses the material program,
the receiving geometry must have finite two-component UVs for every position and
noncollapsed coverage. AO independently requires its declared UV channel. Missing,
partial or invalid coordinates omit the affected maps and keep the procedural
finish. The runtime never fabricates UV1, rewrites geometry, or moves story targets.
Checks are cached by attribute identity/count/version and revalidate changed UVs.

This is a compatibility gate, not an art approval: repeated seams, scale, grazing
response, normal orientation, texture swimming, saturation and black levels still
need visual inspection on the actual receiving mesh. UV1 provided by a review
fixture does not prove that a scene mesh has a valid AO atlas.

Admitted maps supplement the existing physically lit surface and material-memory
shader. Wetness, wear, damage and reintegration remain active, including retained
scars. Do not bake chapter lighting, text or story state into material images.

## Runtime ownership and quality

Automatic delivery is limited to high/cinematic relief detail, without reduced
effects. A local shader-detail override cannot bypass the chapter policy. Low,
medium and reduced effects keep procedural materials and make no map requests.
Borrowed overrides are also omitted under that policy.

No approved maps means no asset-loader lease, decoder workers or map requests.
Approved maps load asynchronously while the complete procedural material remains
visible. Any missing file, decode error, invalid dimension or invalid metadata keeps
that fallback. A partial set is not published after another channel fails.

Material sources are shared per renderer and use the same bounded decoder lease
as hero GLBs. Basis support is detected on the actual renderer and uses the locally
shipped `/basis/` payload from the locked Three version. Each Basis pool has at most
two workers. A zero-consumer cache with work in flight remains reusable until its
transcodes settle, so remounts cannot create overlapping pools. The last consumer
releases clones immediately; sources and the shared decoder lease are released
after pending work settles. Late asynchronous results cannot attach to an unmounted
material or a changed renderer. Concurrent hero users retain their own leases.

## Development review

Run from the repository root after installing dependencies. The script creates an
isolated temporary build; it adds no player UI or production route:

```sh
REVIEW_MATERIALS=wood,wet-wood,plaster,linen,metal \
REVIEW_MODES=procedural,reviewed \
REVIEW_MATRIX=1 \
node scripts/review-material-maps.mjs
```

The fixture compares dry, wet, worn, damaged and reintegrated states using the same
camera and studio lights. Low/high desktop, reduced effects and mobile portrait/
landscape are available through `REVIEW_MATRIX=1`. `REVIEW_STATES=dry,wet` and
`REVIEW_MATERIALS=wood` narrow a pass. `REVIEW_OUT`, `REVIEW_PORT` and
`REVIEW_ANGLE=metal` are optional; default ANGLE is software SwiftShader. Screenshots
and `material-review.json` include actual renderer, delivery status, applied map
channels, requests and render counts. Unmapped finishes are explicitly labelled **unavailable**, with procedural
fallback shown. Wood, wet wood and bark exercise the admitted generated maps.

For decoder/failure/UV testing only, the script can copy the official Three ETC1S
diagnostic from `tests/fixtures/production-delivery/` into its temporary output.
This uses separate fixture metadata and never changes the shipping registry:

```sh
REVIEW_MATERIALS=wood REVIEW_STATES=dry \
REVIEW_MODES=diagnostic,diagnostic-missing,diagnostic-invalid,diagnostic-offline,diagnostic-slow \
node scripts/review-material-maps.mjs
```

`REVIEW_UV=missing-uv` confirms all maps are omitted. Default `REVIEW_UV=uv0`
confirms that diagnostic AO requiring UV1 is omitted while the other channels work.
`REVIEW_UV=ao1` gives the fixture an explicit duplicate atlas to exercise the AO
channel; this is not an atlas generated for runtime scene geometry. Diagnostic
imagery is labelled technical test content, never accepted material art.

Before activating any set, retain matched actual-scene evidence, source metadata,
dimensions/bytes, mobile/reduced-effects checks, missing/decode failure results and
repeated mount/tier-change results. Device review and texture craft remain external
deliverables; a passing loader test does not certify either.
