import { MeshDepthMaterial, RGBADepthPacking, type Mesh, type MeshStandardMaterial } from "three";

type MapGuard = MeshStandardMaterial["onBeforeRender"];
type ShadowBinding = Pick<Mesh, "material" | "customDepthMaterial" | "onBeforeShadow">;
type ShadowClaim = ShadowBinding & { depth?: MeshDepthMaterial };
type ShadowOwnership = { previous: ShadowBinding; claims: ShadowClaim[] };
const owners = new WeakMap<Mesh, ShadowOwnership>();

// Sampler presence/UV channel and alpha-test presence select shader variants.
// Swapping a borrowed texture with the same features only changes its uniform.
function shadowVariant(material: MeshDepthMaterial) {
  return [material.map?.channel ?? -1, material.alphaMap?.channel ?? -1,
    material.displacementMap?.channel ?? -1, material.alphaTest > 0,
    material.alphaHash, material.side].join(":");
}

/** Supported R3F material attach: one private directional/spot depth material.
 * Three's shared depth uniforms can retain a disposed albedo between casters.
 * The private owner borrows maps and never adds textures, passes or subscribers.
 * Point-light distance materials and explicit custom depth owners stay external.
 */
export function attachMaterialShadow(mesh: Mesh, source: MeshStandardMaterial, currentGuard: () => MapGuard) {
  let ownership = owners.get(mesh);
  if (!ownership) {
    ownership = { previous: { material: mesh.material, customDepthMaterial: mesh.customDepthMaterial,
      onBeforeShadow: mesh.onBeforeShadow }, claims: [] };
    owners.set(mesh, ownership);
  }
  const managedDepth = ownership.claims.some(claim => claim.depth === mesh.customDepthMaterial);
  const depth = mesh.customDepthMaterial === undefined || managedDepth
    ? new MeshDepthMaterial({ depthPacking: RGBADepthPacking }) : undefined;
  const previousCallback = mesh.onBeforeShadow;
  let released = false;
  let variant = depth && shadowVariant(depth);
  let version = depth?.version;
  const onBeforeShadow: Mesh["onBeforeShadow"] = depth ? function (this: Mesh, ...args) {
    previousCallback.apply(this, args);
    if (released || mesh.material !== source || mesh.customDepthMaterial !== depth || args[5] !== depth) return;
    const [renderer, object, , camera, geometry, , group] = args;
    // Three renders shadow materials without a Scene. Our map guard consumes
    // only geometry UVs; it must run before the private depth shader is chosen.
    currentGuard().call(source, renderer, null!, camera, geometry, object, group);
    // Three copied source maps BEFORE onBeforeShadow. Refresh the guarded map
    // here, preserving its copied alpha/displacement/clipping/shadow-side state.
    depth.map = source.map;
    const nextVariant = shadowVariant(depth);
    // Material.alphaTest already invalidates its own zero/positive transition.
    if (nextVariant !== variant && depth.version === version) depth.needsUpdate = true;
    variant = nextVariant;
    version = depth.version;
  } : previousCallback;
  const claim = { material: source, customDepthMaterial: depth ?? mesh.customDepthMaterial, onBeforeShadow, depth };
  ownership.claims.push(claim);
  mesh.material = source;
  if (depth) { mesh.customDepthMaterial = depth; mesh.onBeforeShadow = onBeforeShadow; }
  return () => {
    if (released) return;
    released = true;
    const index = ownership.claims.indexOf(claim);
    if (index < 0) return;
    ownership.claims.splice(index, 1);
    const next = ownership.claims[ownership.claims.length - 1] ?? ownership.previous;
    const nextDepth = [...ownership.claims].reverse().find(candidate => candidate.depth) ?? ownership.previous;
    if (mesh.material === source) mesh.material = next.material;
    if (depth && mesh.customDepthMaterial === depth) mesh.customDepthMaterial = nextDepth.customDepthMaterial;
    if (depth && mesh.onBeforeShadow === onBeforeShadow) mesh.onBeforeShadow = nextDepth.onBeforeShadow;
    depth?.dispose();
    if (!ownership.claims.length) owners.delete(mesh);
  };
}
