# Forest textures

The live terrain uses the optimized, tileable `ground-albedo-v4.webp` art pass.
The older v3 remains available to isolated chapter reviews. Generated bark and
alpha-cut canopy materials accompany v4; see [provenance and exact prompts](GENERATED_MATERIALS.md).
Keep new runtime textures compressed and below their declared render budget.

`memory-bloom-v1.png` is the transparent path landmark used to give the living
forest a clear mid-distance focal point. Its runtime budget is 320 KB.

Optional material upgrades can be added here as `.ktx2` files:

```txt
bark.ktx2
crown.ktx2
marsh.ktx2
```

The runtime loader in `src/lib/assets/gltfLoaders.ts` also expects this folder.
