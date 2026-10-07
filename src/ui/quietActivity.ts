export type QuietActivityContext = Readonly<{ participating: boolean; foreground: boolean; overlayOpen: boolean }>;

/** Transient disclosure time only. Held input, hidden gaps and overlays never earn help. */
export function createQuietActivityClock(initialNowMs = 0) {
  let origin = Number.isFinite(initialNowMs) ? initialNowMs : 0;
  let lastNow = origin;
  let context: QuietActivityContext = { participating: false, foreground: false, overlayOpen: false };
  const keys = new Set<string>(), pointers = new Set<number>();
  const reset = (nowMs: number) => {
    const safe = Number.isFinite(nowMs) && nowMs >= 0 ? nowMs : lastNow;
    origin = safe; lastNow = safe;
  };
  return {
    context(next: QuietActivityContext, nowMs: number) {
      if (context.participating !== next.participating || context.foreground !== next.foreground || context.overlayOpen !== next.overlayOpen) {
        keys.clear(); pointers.clear(); reset(nowMs);
      }
      context = { ...next };
    },
    activity: reset,
    key(code: string, held: boolean, nowMs: number) { if (held) keys.add(code); else keys.delete(code); reset(nowMs); },
    pointer(id: number, held: boolean, nowMs: number) { if (held) pointers.add(id); else pointers.delete(id); reset(nowMs); },
    clear(nowMs: number) { keys.clear(); pointers.clear(); reset(nowMs); },
    held() { return keys.size > 0 || pointers.size > 0; },
    sample(nowMs: number) {
      if (!Number.isFinite(nowMs) || nowMs < lastNow) { reset(nowMs); return 0; }
      lastNow = nowMs;
      if (!context.participating || !context.foreground || context.overlayOpen || keys.size > 0 || pointers.size > 0) {
        reset(nowMs); return 0;
      }
      return Math.max(0, nowMs - origin);
    },
  };
}

/** Capture sees mobile control events before their handlers stop propagation. */
export function connectQuietActivity(input: {
  clock: ReturnType<typeof createQuietActivityClock>;
  window: Window; document: Document; now: () => number;
  getContext: () => QuietActivityContext; onReset?: () => void;
}) {
  let disposed = false, pageHidden = false;
  const { clock, window: win, document: doc, now } = input;
  const refresh = () => {
    if (disposed) return;
    const context = input.getContext();
    clock.context({ ...context, foreground: context.foreground && !pageHidden }, now());
  };
  const reset = () => { if (!disposed) { clock.clear(now()); refresh(); input.onReset?.(); } };
  const keyDown = (event: KeyboardEvent) => { if (!disposed) { clock.key(event.code || event.key, true, now()); input.onReset?.(); } };
  const keyUp = (event: KeyboardEvent) => { if (!disposed) { clock.key(event.code || event.key, false, now()); input.onReset?.(); } };
  const pointerDown = (event: PointerEvent) => { if (!disposed) { clock.pointer(event.pointerId, true, now()); input.onReset?.(); } };
  const pointerUp = (event: PointerEvent) => { if (!disposed) { clock.pointer(event.pointerId, false, now()); input.onReset?.(); } };
  const pointerMove = (event: PointerEvent) => {
    if (!disposed && (clock.held() || doc.pointerLockElement) && Math.hypot(event.movementX ?? 0, event.movementY ?? 0) > 1) {
      clock.activity(now()); input.onReset?.();
    }
  };
  const hide = () => { pageHidden = true; reset(); };
  const show = () => { pageHidden = false; reset(); };
  win.addEventListener('keydown', keyDown, true); win.addEventListener('keyup', keyUp, true);
  win.addEventListener('pointerdown', pointerDown, true); win.addEventListener('pointerup', pointerUp, true);
  win.addEventListener('pointercancel', pointerUp, true); win.addEventListener('pointermove', pointerMove, true);
  win.addEventListener('blur', reset); win.addEventListener('focus', reset);
  win.addEventListener('pagehide', hide); win.addEventListener('pageshow', show);
  doc.addEventListener('visibilitychange', reset); refresh();
  return {
    refresh,
    dispose() {
      if (disposed) return; disposed = true; clock.clear(now());
      win.removeEventListener('keydown', keyDown, true); win.removeEventListener('keyup', keyUp, true);
      win.removeEventListener('pointerdown', pointerDown, true); win.removeEventListener('pointerup', pointerUp, true);
      win.removeEventListener('pointercancel', pointerUp, true); win.removeEventListener('pointermove', pointerMove, true);
      win.removeEventListener('blur', reset); win.removeEventListener('focus', reset);
      win.removeEventListener('pagehide', hide); win.removeEventListener('pageshow', show);
      doc.removeEventListener('visibilitychange', reset);
    },
  };
}
