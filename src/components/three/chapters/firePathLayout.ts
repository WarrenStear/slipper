type FirePoint = [number, number, number];

export const FIRE_SOURCE_LOCAL_POSITION: FirePoint = [0, 0, 3.5];

/** The active chapter's material fire shares the fixed story interaction anchor.
 * The left-hand route remains visible as geography from the other fork scenes. */
export function firePathPlacement(active: boolean): { position: FirePoint; rotation: FirePoint } {
  return active
    ? { position: [0, 0, .5], rotation: [0, 0, 0] }
    : { position: [-5.8, 0, .8], rotation: [0, -.36, 0] };
}
