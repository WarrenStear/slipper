# Authored environment art toolkit

The production art pass keeps the current narrative, terrain, camera and interaction
owners. Its new builders own appearance only and do not read or write journey state.

`src/components/three/environmentArt/authoredGeometry.ts` exports owned Three.js
BufferGeometry with normals and UVs. `createWornTimberGeometry(size, seed)` and
`createWeatheredPanelGeometry(size, seed)` stay inside their requested box, so existing
floorboard, wall and furniture transforms remain usable. Their shaved corners and
worn end profiles add silhouette instead of uniformly subdividing boxes.
`createTaperedBranchGeometry(points, radius, seed)` sweeps tapered cross-sections;
`createWaxCandleGeometry(radius, height, seed)` stays centred on Y=0 and models the
melted rim; `createFlameGeometry` creates a teardrop. Dispose each returned geometry,
or pass temporary pieces into `mergeArtGeometries`, which consumes and disposes them.
The merge keeps existing indices and recovers sharing for non-indexed inputs by
matching every stored attribute exactly; UV and normal seams remain distinct.
Revolved poles omit collapsed triangles without changing the visible surface.

`EnvironmentArt.tsx` provides `TimberPiece`, `WeatheredPanel`, `BotanicalCluster`
and `BotanicalBatch`. The botanical batch caps placement count at 160 and uses at
most three instanced material batches. Rose petals, lanceolate leaves, lily pads
and curved reeds are authored once and shared across placements. Instanced bounds
are refreshed when placement changes. There is no plant animation loop.
Base plants retain all leaves and petals with six longitudinal samples instead of
eight and fewer sides/steps on their slender stems. Per-plant triangles are now
356/664 for a rose, 288/512 for a lily and 460/924 for reeds (base/relief).
The relief geometry remains unchanged. The merged-foliage meadow keeps two draws.

The existing tactile policy now includes wet, charred and painted wood, plaster,
velvet, ash and moss in addition to the original eight finishes. Each extends
MeshStandardMaterial, retaining lighting, fog, tone mapping and colour space.
Base quality and reduced effects retain broad colour and roughness structure;
only high/cinematic use bounded, distance-faded normal relief. No new texture
requests or render targets are required. Wet wood intentionally remains rough
and subdued rather than mirror-like.

The reusable Wolf, Swan and Phantom shapes live in `AuthoredNpc.tsx`; their pure
constructors are in `npcGeometry.ts`. They use a grounded origin and +Z forward.
Wolf's posture, paws, muzzle and ears remain legible in the base tier. Swan uses a
variable-width neck and layered pointed feathers; Phantom uses a folded mantle
and hood. Wolf/Swan have three material draws, Phantom two. Current per-instance
triangles are 2,168/3,016 for Wolf, 1,164/1,532 for Swan and 392/528 for Phantom
(base/relief), before any scene-level culling. These are renderer topology budgets,
not physical-device FPS measurements.

Interactive props preserve their existing local origin and semantic wrappers.
The rose now has three draws instead of fourteen; the chair has one instead of
twelve; the closed book has five instead of nine. The nest is a horizontal woven
bowl, candle wax has a physical melted rim and flame outline, and the living seed
uses pointed leaves. Low-quality forms remain complete; only layer/sample density
changes. The chapter system controls placement and story actions as before.
Chair indexing retains the same 1,432 triangles and exact expanded attributes while
reducing retained geometry from 4,296 to 906 vertex records (137,472 to 37,584 bytes).

`tests/authored-art.test.mjs` checks deterministic output, requested architecture
bounds, finite attributes, face winding, low/high triangle ceilings and GLB
instance ownership. The screenshot harnesses provide separate rendered evidence;
passing geometry tests does not establish composition or full gameplay correctness.
`tests/authored-art-optimization.test.mjs` additionally checks expanded attribute
equivalence against the recorded pre-optimization source, exact seam preservation,
pole topology, and the base plants' leaf/petal counts and bounded silhouettes.
See `public/models/README.md` for explicit placeholder provenance and the production
GLB replacement contract.
