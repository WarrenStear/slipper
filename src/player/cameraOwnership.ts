// Keyed by the actual camera so review canvases can coexist with the live world.
const owners = new WeakMap<object, Set<symbol>>();

export function claimCameraAuthority(camera: object) {
  const token = Symbol("player-camera");
  const claims = owners.get(camera) ?? new Set<symbol>();
  claims.add(token);
  owners.set(camera, claims);
  return () => {
    if (!claims.delete(token)) return;
    if (claims.size === 0) owners.delete(camera);
  };
}

/** Standalone review adapters yield whenever the real camera controller is mounted. */
export function cameraHasAuthority(camera: object) {
  return (owners.get(camera)?.size ?? 0) > 0;
}
