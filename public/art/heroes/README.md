# Reviewed hero art

This directory is reserved for reviewed production GLBs. It currently contains
no production models. All 13 entries in
[`HERO_ASSETS`](../../../src/components/three/actors/heroAssetRegistry.ts) remain
`authored-fallback` with `url: null`; their authored presentations stay active.
Adding a file here does not activate it.

The legacy [`public/models/`](../../models/README.md) GLBs are explicitly marked
placeholders, including the prop files. Do not copy them here, rename them, remove
their placeholder metadata, or use their filenames as evidence of review.
Concept PNGs in `docs/visual-concepts/` are composition references, not models,
textures or scene backgrounds.

## Admission and ownership

An asset is eligible only after its registry entry explicitly uses
`status: "reviewed-production"`, a safe local `/art/heroes/*.glb` URL, and the
review metadata below. Traversal, escaped paths, queries, fragments, redirects,
and remote URLs are rejected. Keep an
unreviewed or unavailable slot in `authored-fallback`. `HeroAssetSlot` retains
the authored fallback during loading, on a missing file/network/decode error,
or when validation rejects the asset. Failed required texture decoding also
rejects a GLB even when Three.js resolves its scene with a null material map. Registry admission is a review gate, not an
automatic proof of artistic quality or licence clearance.

Match the selected registry entry's exact metres, origin, bounds and forward
axis. Review the consuming `HeroAssetSlot` transforms as well as the GLB itself.
The model replaces presentation geometry only: actor choreography, interaction
IDs, colliders, state transitions, lights, water and reflection ownership stay
with the existing scene. Imported animation clips are not automatically played.

| Slot | Required physical and narrative boundary |
| --- | --- |
| `master-lantern` | Housing only; base Y=0, handle Y=1.18, radius 0.29 m. Core, glass, light and carried motion stay external. |
| `wolf` / `wolf-resting` | Standing feet at Y=0, forward +Z; resting has its own pose. The cue owns movement and visibility. |
| `swan` | Waterline at Y=0, forward +Z; the cue owns water displacement. |
| `seer-reflection` | Mirror-local apparition only; never introduce a free-standing Seer. |
| `cracked-mirror` | Frame only; preserve the live reflection, scars and interaction surface. |
| `moon-bridge` | Match the physical walkway's deck height, width and route. |
| `key` | Match the existing key scale and interaction origin. |
| `roses` / `lilies` | Root/waterline at the origin; retain the batched beds. |
| `writing-desk` / `reading-chair` | Match the footprint and contact points; preserve papers and open circulation. |
| `fountain` | Basin geometry only; water, sound and placement remain scene-owned. |

## Delivery and review

1. Record the artist/source, licence or permission, editable source location,
   export settings, revision and reviewer/date beside the asset or in the review
   record. Do not ship private source material merely to fill this directory.
2. Export glTF 2.0 with normals, useful UVs and bounded PBR materials, without
   embedded cameras or lights. Merge parts sharing a material and retain a clear
   silhouette at low quality. Compare triangles, material batches and texture
   memory with the fallback; document any increase. Near actors initially target
   about 5,000 triangles and at most three materials, subject to measured review.
3. Export one scene containing triangle meshes only (triangle lists, strips,
   and fans are supported; points/lines and alternate scenes are rejected).
   Export a self-contained GLB: buffers and images must use embedded buffer
   views, not external or data URIs. Check compression end to end. Local Draco
   decoders at `/draco/` and Basis/KTX2 transcoders at `/basis/` are bundled from
   the locked Three.js release; see their adjacent provenance READMEs. A
   successful export or CLI compression alone is insufficient.
4. Review the actual scene in desktop and phone portrait/landscape, low/high and
   reduced-effects/motion modes. Check scale, silhouette, negative space, fog,
   transparency, visual collision alignment, loading/failure fallback, and
   multiple instances with different opacity. Preserve actor/interaction bounds.
5. Only then change that registry entry's status and URL. Keep capture and cost
   evidence with the review. Physical-device performance remains a separate gate.

## Traceable registry review

`approvedHeroAsset` requires a nonempty contract and these `review` fields:

- `provenance`, `licence`, `reviewedBy`, and `revision`: meaningful nonempty text.
  `artist` is optional when the provenance already identifies the maker.
- `reviewedAt`: a real UTC ISO timestamp, such as `2026-09-26T12:00:00Z` or
  `2026-09-26T12:00:00.000Z`. Rolled calendar dates are rejected.
- `maxTriangles`, `maxMaterials`, `maxTextures`, `maxTextureDimension`: reviewed
  budgets. Start near 5,000 triangles / three materials / 1024-pixel textures for
  actors. Any increase needs scene evidence. Hard admission ceilings are 200,000
  triangles, 32 materials, 32 textures and 2048 pixels; these are corruption
  safeguards, not recommended budgets. Standalone production material maps keep
  their separate 1024-pixel ceiling.
- `bounds: { min: [x,y,z], max: [x,y,z] }`: the measured allowable envelope in
  local metres, before the consuming slot's existing transform. The loader
  rejects out-of-envelope geometry; it never automatically rescales it.
- Optional `baseY: { value, tolerance }` for measurable foot/base contact; use a
  small tolerance. Waterline and mirror-local origins require the appropriate
  measured envelope and visual review, not a generic feet-at-zero rule.
- Optional `allowSceneLights: true` only after an explicit lighting integration
  review. Default is false. Lantern lighting remains forbidden even with this
  flag; embedded cameras are always forbidden.

The runtime checks finite transforms/attributes/indices, nonempty triangles,
reviewed geometry/material/texture budgets, texture dimensions and required UV
channels. It also checks the Lantern housing's base, height and radius, and
rejects emissive Lantern housing/key materials. These checks cannot recognise a
baked fake mirror reflection, artistically correct anatomy, a named handle, or
+Z pose direction: reviewers must still inspect those requirements in the
actual scene. Animation clips may be present but are never played automatically.

## Loading and resource ownership

Hero requests use same-origin credentials, reject redirects, cap compressed
input at 16 MiB, and abort a fetch/body that exceeds 15 seconds. No decoder or
hero network request is created for an unreviewed slot. The legacy `/models/`
path also cannot bypass registry approval merely by replacing a file.

Heroes and material maps share a renderer-specific decoder pool, with at most
two Draco and two Basis workers per renderer and local runtime paths. Renderer
capabilities are detected for that renderer. Mounted heroes share a parsed
source per slot/URL/review revision; up to 16 active source entries are admitted
per renderer. Loading never suspends the whole scene.

Model instances own cloned materials, skeleton bones and inverse-bind matrices.
Cached geometry and textures remain shared; do not dispose them from an
individual scene instance. The last source consumer aborts pending network work
and disposes the source's geometry/materials/textures once parsing settles.
An early GLTF parse error waits for sibling dependency/decode work and disposes
partially parsed resources. Decoder leases remain alive for non-abortable parse/transcode work and are
released after the last user, with deferred cleanup for StrictMode replay.
No collision, animation mixer, interaction target, or story controller is
created from the imported scene.

## Review tooling

Run `node scripts/review-hero-art.mjs` from the repository root. The bounded
studio review covers low/high quality and lit/monochrome silhouettes. Use
`REVIEW_HEROES=lantern,swan` to limit slots, and `REVIEW_MATRIX=1` to add desktop
reduced effects plus mobile portrait/landscape variants. `REVIEW_ANGLE=metal`
selects the native Metal backend where available; `REVIEW_OUT` sets the output
folder.

For each admitted production entry the tool captures fallback and the actual
loaded model under the same camera. It waits for the production scene to mount
and records its revision, bytes, geometry/material/texture budgets, plus render
counts. With no admitted model, its report explicitly marks the production
comparison unavailable; it never relabels a fallback or a synthetic fixture as
production. These studio views complement actual-scene review and do not certify
physical-phone performance. Failure/decoder diagnostics use separately labelled
test-only fixtures outside the production registry.


There is no reviewed `crown` hero slot: do not enable `public/models/crown.glb`
or bypass the registry to add one.
