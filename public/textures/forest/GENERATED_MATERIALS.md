# Woodland material provenance — 25 October 2026

Created for this project with the built-in image generation tool. These are AI-generated material images, not photographic scans or licensed third-party texture packs. Original outputs remain outside the repository. Runtime copies were resized with Lanczos and encoded as WebP at quality 77 (ground) / 88 (bark and foliage); the foliage alpha channel is preserved. Existing versions are retained.

| Runtime asset | Size | Encoded bytes | Use |
| --- | --- | ---: | --- |
| `ground-albedo-v4.webp` | 1024 × 1024 RGB | 376,292 | Continuous forest terrain; repeat 144 |
| `bark-albedo-v1.webp` | 1024 × 1024 RGB | 508,790 | Continuous forest and willow bark |
| `canopy-spray-v1.webp` | 512 × 512 RGBA | 110,912 | Alpha-cut canopy cards; threshold 0.45 |

Total encoded transfer is 995,994 bytes before HTTP overhead. These are base-colour maps, not full scanned PBR sets. Existing procedural roughness/relief remains authoritative where supported. Normal and roughness images were not fabricated from colour and labelled as scans. The willow uses the bark albedo at every quality setting; canopy transparency uses alpha testing with depth writes, not blended sorting. Low and reduced-effects tiers retain their smaller geometry budgets and no global shadow map.

Final prompts, verbatim:

## Ground

Use case: photorealistic-natural. Asset type: seamless repeating game terrain albedo texture, square 1024x1024. Create a flat orthographic top-down scan-like surface of a temperate ancient woodland floor: weathered taupe brown soil, subtle small pebbles, fine decayed oak leaves, patches of soft olive moss, occasional thin roots. Physically plausible natural material, exceptionally sharp small-scale detail. Mid-value diffuse albedo under perfectly even neutral overcast illumination; NO dark baked ambient occlusion, no directional shadows, no sun spots, no glossy highlights, no perspective, no border, no text, no objects protruding, no flowers. Surface represents a roughly 3x3 metre patch. Seamlessly tile all four edges. Restrained muted earth and sage palette; enough uncluttered soil for walking. This is a runtime material map, not a landscape scene.

## Bark

Use case: photorealistic-natural. Asset type: seamless repeating PBR base-colour texture for old woodland trunks and willow branches, square 1024x1024. Orthographic flat close-up of aged grey-brown willow/oak bark: long irregular vertical fissures, fibrous ridges, fine granular weathering, tiny sparse grey-green lichen and moss confined within some cracks. Realistic photographic surface detail. Mid-value taupe and silvery warm grey diffuse albedo, perfectly uniform neutral illumination. Seamlessly tile both axes with vertical grain. No tree silhouette, no background, no branch, no perspective, no frame or text. No dramatic dark baked shadows, no directional highlights. The texture must read clearly in soft forest light.

## Canopy

Use case: photorealistic-natural. Asset type: transparent foliage cutout for realtime 3D tree canopy cards, square 1024x1024. A single complete delicate deciduous twig spray viewed almost front-on, loosely spreading upward and outward: about 26 small natural oval pointed woodland leaves on fine brown branching twigs. Leaf colours vary naturally from medium sage green to olive green, slightly lighter new tips, visible subtle veins. High photographic detail, soft neutral shadowless lighting, no cast shadows. Sprig fills 85 percent of image and stays fully inside edges with transparent margins. Airy irregular silhouette with clear transparent gaps between leaves. True alpha transparency behind and between every leaf and stem. No ground, sky, pot, text, frame, border, glow, watermark, or checkerboard baked into image. Branch grows from bottom centre toward upper half. Designed to form dense realistic layered tree canopies when instanced.

The 64 × 64 thresholded alpha fixture in `tests/fixtures/canopy-alpha.json` is derived from the final compressed canopy image and pins its SHA-256. Geometry coverage tests use ray-intersection UVs against that mask, so transparent space does not count as a solid canopy. Original image generation requested 1024 square; the runtime foliage copy is deliberately reduced to 512 square.


## Weathered stone — woodland art pass

`stone-albedo-v1.webp` is a new 768 × 768 RGB base-colour map, 259,200 bytes, generated with the built-in image generation tool and resized with Lanczos / WebP quality 83. The original output is retained outside the repository. The four current woodland maps total 1,255,194 encoded bytes. Rocks use this map with smooth seam-aware geometry normals and vertex-colour moss; high/cinematic materials also use a small albedo-derived bump for artistic relief. This is an approximation, not a scanned normal or height map. Low/medium retain the same albedo without that bump cost. Shore sediment reuses the existing ground map.

Exact stone prompt:

Use case: photorealistic-natural. Create a square seamless tileable base-color texture for weathered woodland granite, flat orthographic macro photograph of a continuous grey stone surface, approximately 70cm across. Fine irregular quartz and feldspar mineral grains, charcoal hairline fissures, softly weathered muted cool grey with warm grey variation, small very restrained pale sage crustose lichen patches covering 12 percent, tiny moss flecks inside shallow crevices. Realistic physically plausible stone surface with rich close detail and gentle broad mottling. Even diffuse neutral shadowless illumination, no directional cast shadow, no specular highlight, no perspective, no individual boulders, no background, no ground, no leaves, no text or markings or grid or border. Seamless across opposite edges, no obvious repeated pattern. This is a material albedo for realtime three-dimensional forest rocks, not a scene render. 1024x1024.

The twilight sky reuses `../environment/moon-albedo-v1.png` for the one distant blue moon; this pass adds no new moon texture.
