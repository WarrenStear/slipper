type AtmosphereSurface = { background: unknown; fog: unknown };
type AtmosphereClaim = { background: unknown; fog: unknown };
type AtmosphereOwnership = { previous: AtmosphereClaim; claims: AtmosphereClaim[] };
const owners = new WeakMap<AtmosphereSurface, AtmosphereOwnership>();

/** Restore the preceding live owner, even when React cleans up out of order. */
export function bindSceneAtmosphere(surface: AtmosphereSurface, background: unknown, fog: unknown) {
  let ownership = owners.get(surface);
  if (!ownership) {
    ownership = { previous: { background: surface.background, fog: surface.fog }, claims: [] };
    owners.set(surface, ownership);
  }
  const claim = { background, fog };
  ownership.claims.push(claim);
  surface.background = background;
  surface.fog = fog;
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const index = ownership.claims.indexOf(claim);
    if (index < 0) return;
    ownership.claims.splice(index, 1);
    const next = ownership.claims[ownership.claims.length - 1] ?? ownership.previous;
    if (surface.background === claim.background) surface.background = next.background;
    if (surface.fog === claim.fog) surface.fog = next.fog;
    if (ownership.claims.length === 0) owners.delete(surface);
  };
}
