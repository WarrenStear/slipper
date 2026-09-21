/** Lens and composition only. No camera translation, story writes or saved state. */
export type ShotComposition = Readonly<{
  lensOffset: number;
  portraitExpansion: number;
  screenX: number;
  screenY: number;
  maxTurn: number;
}>;

const neutral: ShotComposition = Object.freeze({ lensOffset: 0, portraitExpansion: 0, screenX: 0, screenY: 0, maxTurn: .045 });
const shot = (lensOffset: number, portraitExpansion: number, screenX = 0, screenY = 0): ShotComposition =>
  Object.freeze({ lensOffset, portraitExpansion, screenX, screenY, maxTurn: .045 });

/** Small framing adjustments retain each scene's authored emotional lens. */
const SHOTS: Readonly<Record<string, ShotComposition>> = Object.freeze({
  "broken-floor.confession": shot(0, 6),
  "blue-moon.sanctuary": shot(-1, 9, -.055, -.015),
  "blue-moon.intimacy": shot(-1, 9, -.04, -.02),
  "blue-moon.caged-bird": shot(0, 7),
  "thorned.locked-garden": shot(0, 7),
  "thorned.old-memory-bedroom": shot(0, 7),
  "thorned.self-owned-world": shot(0, 8),
  "enchanted.rabbit-hole": shot(0, 8, .035, -.025),
  "enchanted.friendship-meadow": shot(-1, 8, .035, -.025),
  "enchanted.masked-hearth": shot(0, 7),
  "epilogue.constellation": shot(0, 9),
});

export function shotComposition(sceneId: string): ShotComposition {
  return Object.prototype.hasOwnProperty.call(SHOTS, sceneId) ? SHOTS[sceneId] : neutral;
}

export function shotLens(sceneId: string, authoredFov: number, aspect: number, comfort = false) {
  if (comfort) return 65;
  const fov = Number.isFinite(authoredFov) ? authoredFov : 65;
  const ratio = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const profile = shotComposition(sceneId);
  // Bounded vertical expansion protects portrait context without an extreme wide lens.
  const portrait = Math.min(1, Math.max(0, (1 - ratio) / .55));
  return Math.min(78, Math.max(52, fov + profile.lensOffset + portrait * profile.portraitExpansion));
}

export function settleLens(current: number, desired: number, delta: number, comfort = false) {
  if (comfort || !Number.isFinite(current)) return desired;
  const dt = Math.max(0, Math.min(.05, Number.isFinite(delta) ? delta : 0));
  const step = (desired - current) * (1 - Math.exp(-dt * .9));
  // Limit angular change as well as smoothing: no snap on an orientation/scene change.
  return current + Math.max(-dt * 3, Math.min(dt * 3, step));
}

export type ShotSettle = { elapsed: number; turned: number };
export function createShotSettle(): ShotSettle { return { elapsed: 0, turned: 0 }; }
export function resetShotSettle(state: ShotSettle) { state.elapsed = 0; state.turned = 0; }

/** At most four seconds and 2.6 degrees per uninterrupted idle interval. */
export function advanceShotSettle(state: ShotSettle, delta: number, speed: number, enabled: boolean, maxTurn = .045) {
  if (!enabled) { resetShotSettle(state); return 0; }
  const dt = Number.isFinite(delta) ? Math.max(0, Math.min(.05, delta)) : 0;
  const rate = Number.isFinite(speed) ? Math.max(0, Math.min(.018, speed)) : 0;
  const budget = Number.isFinite(maxTurn) ? Math.max(0, Math.min(.045, maxTurn)) : 0;
  if (dt === 0 || rate === 0 || state.elapsed >= 4) return 0;
  const duration = Math.min(dt, 4 - state.elapsed);
  const envelope = Math.sin(Math.PI * Math.min(1, (state.elapsed + duration / 2) / 4));
  const turn = Math.min(Math.max(0, budget - state.turned), rate * duration * envelope);
  state.elapsed += duration; state.turned += turn;
  return turn;
}

/** Frame a visible guide off-centre without changing its true world position. */
export function shotAimOffset(sceneId: string, distance: number, fov: number, aspect: number): [number, number] {
  if (![distance, fov, aspect].every(Number.isFinite) || distance <= 0 || aspect <= 0) return [0, 0];
  const profile = shotComposition(sceneId);
  const halfHeight = Math.min(30, distance) * Math.tan(Math.min(78, Math.max(52, fov)) * Math.PI / 360);
  // Reduce lateral styling in portrait rather than pushing the subject toward an edge.
  const lateral = Math.min(1, aspect);
  return [-profile.screenX * halfHeight * Math.min(2, aspect) * lateral, -profile.screenY * halfHeight];
}

export type CameraPresentationContext = {
  visible: boolean; focused: boolean; overlayOpen: boolean; mode: string;
  controls: string; physicsPaused: boolean; sceneCurrent: boolean;
};
export function cameraPresentationActive(context: CameraPresentationContext) {
  return context.visible && context.focused && !context.overlayOpen && context.mode === "explore"
    && context.controls === "walk" && !context.physicsPaused && context.sceneCurrent;
}

/** Lens motion yields to unbuttoned mouse-look and wheel input too.
 * Pointer lock does not require a held mouse button, so held-pointer state alone
 * is insufficient. Keep the horizon/lens quiet through a brief handoff interval. */
export function shotLensHeld(inputActive: boolean, nowMs: number, lastInputMs: number) {
  return inputActive || !Number.isFinite(nowMs) || !Number.isFinite(lastInputMs)
    || nowMs - lastInputMs < 350;
}
