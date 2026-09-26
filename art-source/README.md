# Generated oak and bark material sources

These editable PNGs were generated specifically for Slipper in the Woods through
OpenAI ImageGen on 2026-09-26. No external source photographs or third-party
texture library were used. The project owner requested generated assets for this
implementation. They are generated material approximations, not measured PBR
maps, licensed scans or photogrammetry.

`oak/` contains weathered timber albedo and matching generated normal/roughness
images. `bark/` contains aged oak bark and its matching data maps. Source records
include original and runtime SHA-256 hashes, dimensions, byte budgets, generation
intent, normal orientation checks and packing details. The original source files
are kept out of the runtime `public/` directory.

Runtime albedo is sRGB. Normal and roughness are linear data, with roughness read
from green. Normals are tangent-space OpenGL with material normalScale `.24`.
The bark generator produced a green-down result despite the requested convention;
packing inverts green. Comparison with broad fissure edges, numeric gradient
signs and rendered light response informed this conversion. It is an approximate
art check, not certification of a measured normal field.

Mip levels use Lanczos downsampling, bottom row first, `KTXorientation=ru` and
`flipY=false` in Three r171. Raw RGBA8 levels are Zstandard-compressed in KTX2;
there is no claim of GPU block-compressed storage. Albedo is 512px, other channels
256px. Each set is approximately 2MiB of decoded source data with all mips; shared
cache sources and per-consumer transform clones use the existing runtime.

The local material review script renders technical box/sphere samples separately
from integrated gameplay evidence. Whole-world root/bridge captures are required
to establish scale, texture attachment, board construction and readability.

Repack after source editing with Node 24 (or a compatible Node runtime exposing
`zstdCompressSync`) and the repository's existing installed asset-tool dependencies:

```sh
node art-source/encode-materials.mjs
```
