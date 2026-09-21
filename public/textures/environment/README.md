# Environment textures

`first-wood-panorama-v2.webp` is the compressed 2:1 atmospheric forest backdrop.
It supplies distant canopy, trunk, mist, and path depth behind the interactive
terrain while staying below the runtime's 250 KB panorama budget.

`first-wood-panorama-v3.webp` is the runtime panorama. Its 64-pixel wrap-aware
edge blend removes the vertical seam while retaining the same compact forest
detail; chapter forest density now controls how strongly it appears.

`first-wood-depth-plate-v1.webp` is the medium-and-up forward forest plate.
It adds photographic bark, fern, mist, and canopy-ray depth to the opening view
while staying below 180 KB; low quality retains the panorama alone.

`forest-sky-horizon-v1.webp` is the current medium-and-up horizon plate. It
adds moonless cloud depth, receding ridgelines, and valley mist behind the
dynamic moon and stars. The shader feathers it into the procedural sky and
chapter fog so it never becomes a full-screen background card.

`moon-albedo-v1.png` is a 384px transparent lunar albedo cutout with crater and
mare detail. It stays below 240 KB and replaces the former flat white moon disc
without adding another render pass.
