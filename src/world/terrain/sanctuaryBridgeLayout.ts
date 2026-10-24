/** Metre dimensions shared by visible approaches and Rapier support. */
export const SANCTUARY_BRIDGE_DECK = { position: [0, 0, .06], halfExtents: [1.86, .11, 7.66] } as const;
export const SANCTUARY_BRIDGE_STEPS = [-1, 1].flatMap(side => [
  { position: [0, -.16, side * 7.95] as [number, number, number], size: [3.75, .2, .8] as [number, number, number] },
  { position: [0, -.3, side * 8.65] as [number, number, number], size: [3.95, .2, .65] as [number, number, number] },
]);
