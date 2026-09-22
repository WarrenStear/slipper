# NPC model assets

The checked-in GLBs are explicitly marked placeholders (`asset.generator` is
`SIDTW placeholder NPC generator`). They are not finished production art:
`wolf.glb` has 6 triangles, `phantom.glb` has 8, and `swan.glb` has 5. The other
prop GLBs currently repeat the same Swan placeholder mesh. Do not infer that a
prop is production-ready merely because its filename exists.

The active story presents authored procedural Wolf, Swan and reflected Phantom
silhouettes from `src/components/three/environmentArt/AuthoredNpc.tsx`. They share
fixed local origins and keep actor cues, interaction bounds and progress state
outside the visual component. Base quality retains anatomy; higher quality adds
curve samples and feather layers. These are intentional fallbacks, not a claim
that bespoke rigged character assets have been supplied.

`OptimizedNpcModel` is the reusable production GLB slot for Wolf, Phantom and
Swan. It shows the same silhouette during loading, on a load failure, or when
explicit placeholder metadata is present. It accepts ordinary low-poly authored
assets without imposing a minimum triangle count. Each instance owns cloned
materials and skeletons, preserving source transparency; geometry and textures
remain shared by the loader. It is currently a reusable slot rather than the
owner of the active story's actor choreography.

## Preparing replacement assets

1. Keep editable originals in `public/models/source/`, with provenance and licence
   recorded beside each model. No third-party production models are bundled here.
2. Author in metres, with Y up and +Z forward, feet/body contact at Y=0. Preserve
   the intended silhouette and review transforms in the consuming scene. Approximate
   procedural bounds: standing Wolf 1.0 m wide / 1.5 m high / 2.4 m long; Swan
   0.8 m wide / 1.4 m high / 1.9 m long; Phantom 1.1 m wide / 2.35 m high.
3. Export glTF 2.0 with normals, UVs, sensible PBR base colour and roughness, and
   no cameras or lights. Replace the placeholder generator metadata. Merge parts
   that share a material. Target at most three materials and roughly 5,000 triangles
   for a near actor; use measured device performance to justify a larger budget.
4. Run `npm run assets:inspect:wolf` / `assets:inspect:phantom` and the configured
   `assets:compress` script after installing the glTF Transform CLI dependencies.
   Draco/KTX2 compression needs the matching decoder and transcoder files served
   at `/draco/` and `/basis/`; KTX2 conversion also requires the CLI's external
   encoder tooling. Those binaries are not supplied by the placeholder GLBs.
5. Review the result in low, high and reduced-effects modes, at phone portrait
   and landscape sizes. Check fog, colour management, model dimensions, alpha,
   missing-file fallback and two simultaneous instances with different opacity.
   Compression success alone is not visual acceptance.

Use the same output filenames (`wolf.glb`, `phantom.glb`, `swan.glb`) to adopt a
replacement in the reusable slot. Animation clips are not automatically played;
adding rigged animation requires a separate presentation integration that leaves
story cue/state ownership in place. StoryScene also retains a separate legacy
encounter renderer; dropping a file in this folder does not migrate that renderer.
