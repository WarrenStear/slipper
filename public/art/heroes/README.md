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
`status: "reviewed-production"` and a local `/art/heroes/*.glb` URL. Keep an
unreviewed or unavailable slot in `authored-fallback`. `HeroAssetSlot` retains
the authored fallback during loading, on a load error, or when explicit
placeholder metadata is detected. Registry admission is a review gate, not an
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
3. Check compression end to end. The loader expects Draco decoders at `/draco/`
   and Basis/KTX2 transcoders at `/basis/`; those runtime files are not currently
   bundled. Supply and verify the required payloads before enabling an asset
   that needs them. A successful export or CLI compression alone is insufficient.
4. Review the actual scene in desktop and phone portrait/landscape, low/high and
   reduced-effects/motion modes. Check scale, silhouette, negative space, fog,
   transparency, visual collision alignment, loading/failure fallback, and
   multiple instances with different opacity. Preserve actor/interaction bounds.
5. Only then change that registry entry's status and URL. Keep capture and cost
   evidence with the review. Physical-device performance remains a separate gate.

Model instances own cloned materials and skeletons. Loader-cached geometry and
textures are shared; do not dispose them from an individual scene instance.
There is no reviewed `crown` hero slot: do not enable `public/models/crown.glb`
or bypass the registry to add one.
