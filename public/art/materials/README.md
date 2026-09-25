# Reviewed material maps

This directory is reserved for compact reviewed material maps. It currently
contains no production textures. The 11 entries in
[`MATERIAL_MAPS`](../../../src/components/three/materials/materialMapRegistry.ts)
remain `procedural-fallback`: wet wood, bark, plaster, linen, velvet, stone,
earth, ash, metal, paper and wood. Other surfaces also retain their procedural
finish when no approved entry exists. Creating a file here does not enable it.

Concept art in `docs/visual-concepts/` is reference material; do not use those
PNGs as texture maps or backgrounds. Existing placeholder models do not establish
approval for their materials.

## Registry and texture contract

Each enabled entry must explicitly use `status: "reviewed-production"`, a
declared `maxDimension`, a two-axis `repeat`, and at least one approved channel.
Keep `procedural-fallback` until provenance, surface appearance and runtime
delivery have been reviewed.

| Property | Existing admission contract |
| --- | --- |
| URL | Local `/art/materials/` path ending in `.ktx2`; lowercase letters, digits, `/`, `_` and `-` in the asset path. No remote URLs or traversal. |
| Channels | `map`, `normalMap`, `roughnessMap`, `aoMap` only. |
| Dimensions | Declared finite maximum from 1 through 1024 pixels; decoded width and height must also fit that maximum. |
| Repeat | Two finite values greater than 0 and at most 32; review against the scene's actual UV scale. |
| Colour space | Albedo (`map`) is sRGB; normal, roughness and AO are non-colour data. |
| Runtime tier | Automatic loading is limited to high/cinematic relief detail without an explicit map override. Low, medium and reduced effects keep the procedural finish. |

The approved maps supplement the existing lit material and material-memory
shader. Preserve wear, dampness, scars, reintegration and SceneLook authority;
do not bake chapter lighting, text or story state into albedo maps. Check the
normal-map convention and the actual mesh UVs, including the UV channel used
for AO, in the receiving scene rather than assuming a file alone is compatible.

## Delivery and review

1. Record source/artist, licence or permission, editable source location, export
   settings, actual dimensions and bytes, revision and reviewer/date. Use only
   maps needed by the surface; do not fill all channels with meaningless images.
2. Deliver compressed KTX2 maps and verify transcoding on the browser matrix.
   The loader expects its Basis runtime at `/basis/`; those transcoder files are
   not currently bundled. Supply and verify them before enabling reviewed maps.
3. Compare the actual material in dry, wet, worn and damaged states where
   applicable. Inspect seams, UV scale, grazing highlights, black levels and
   silhouette against the procedural version under the same camera and lighting.
4. Measure downloads, texture memory and frame/render cost. Keep the existing
   1024-pixel bound and avoid extra lights, render targets or material variants.
   Review desktop, mobile portrait/landscape, quality changes and reduced effects.
5. Exercise missing-file and decode-failure fallback, repeated mount/unmount,
   and tier changes before changing the entry to `reviewed-production`. Retain
   evidence; automated acceptance does not substitute for art or device review.

Unreviewed entries create no texture loader or request. Loading failures retain
the procedural finish. The runtime shares source maps per renderer, creates
consumer-owned transform/colour-space clones, and releases the source cache and
its bounded two-worker transcoder pool after the last consumer leaves. Consumers
must not dispose borrowed maps or add a second independent loading/cache system.
