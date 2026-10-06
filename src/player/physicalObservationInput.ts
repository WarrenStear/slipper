import type { PhysicalObservationBinding } from "./physicalObservation.ts";

export type PhysicalInputSignal = Readonly<{
  binding: PhysicalObservationBinding;
  observedAtMs: number;
  kind: "input" | "suspend";
}>;

/** DOM boundary only. The injected runtime host owns the lease, activity policy,
 * subscription sources and clock. This bridge never binds, releases or advances
 * a narrative session, and never consumes movement/look input.
 */
export function connectPhysicalObservationInput({ windowTarget, documentTarget,
  getBinding, getActivity, now, subscribeActivity, onSignal }: {
  windowTarget: EventTarget;
  documentTarget: EventTarget & { hidden?: boolean };
  getBinding: () => PhysicalObservationBinding | null;
  getActivity: () => boolean;
  now: () => number;
  /** Notify only relevant overlay/mode/physics/restore edges, including an
   * active-to-active restoration. Each notification resets physical continuity. */
  subscribeActivity?: (notify: () => void) => () => void;
  onSignal?: (signal: PhysicalInputSignal) => void;
}) {
  let disposed = false, pageActive = true, pageFocused = true, active = false;
  let binding: PhysicalObservationBinding | null = null;
  const same = (a: PhysicalObservationBinding | null, b: PhysicalObservationBinding | null) =>
    a === b || a !== null && b !== null && a.port === b.port && a.lease === b.lease;
  const signal = (current: PhysicalObservationBinding, observedAtMs: number, kind: PhysicalInputSignal["kind"]) =>
    onSignal?.({ binding: current, observedAtMs, kind });
  const suspend = (current: PhysicalObservationBinding | null, observedAtMs: number) => {
    if (current?.port.suspend(current.lease, observedAtMs)) signal(current, observedAtMs, "suspend");
  };
  const refreshActivity = (forceReset = false) => {
    if (disposed) return false;
    const next = getBinding(), observedAtMs = now();
    const changed = !same(binding, next);
    if (changed && binding) suspend(binding, observedAtMs);
    binding = next;
    const nextActive = binding !== null && pageActive && pageFocused
      && documentTarget.hidden !== true && getActivity() === true;
    if (changed || forceReset || active !== nextActive) suspend(binding, observedAtMs);
    active = nextActive;
    return active;
  };
  const key = (held: boolean) => (event: Event) => {
    if (!refreshActivity() || !binding) return;
    const code = (event as KeyboardEvent).code, observedAtMs = now();
    if (binding.port.key(binding.lease, code, held, observedAtMs)) signal(binding, observedAtMs, "input");
  };
  const pointer = (held: boolean) => (event: Event) => {
    if (!refreshActivity() || !binding) return;
    const pointerId = (event as PointerEvent).pointerId, observedAtMs = now();
    if (binding.port.pointer(binding.lease, pointerId, held, observedAtMs)) signal(binding, observedAtMs, "input");
  };
  const blur = () => { pageFocused = false; refreshActivity(true); };
  const focus = () => { pageFocused = true; refreshActivity(true); };
  const pagehide = () => { pageActive = false; refreshActivity(true); };
  const pageshow = () => { pageActive = true; refreshActivity(true); };
  const resetContinuity = () => { refreshActivity(true); };
  const capture = { capture: true, passive: true };
  const listeners: ReadonlyArray<readonly [EventTarget, string, EventListener]> = [
    [windowTarget, "keydown", key(true)], [windowTarget, "keyup", key(false)],
    [windowTarget, "pointerdown", pointer(true)], [windowTarget, "pointerup", pointer(false)],
    [windowTarget, "pointercancel", pointer(false)], [windowTarget, "lostpointercapture", pointer(false)],
    [windowTarget, "blur", blur], [windowTarget, "focus", focus],
    [windowTarget, "pagehide", pagehide], [windowTarget, "pageshow", pageshow],
    [documentTarget, "visibilitychange", resetContinuity], [documentTarget, "pointerlockchange", resetContinuity],
  ];
  for (const [target, type, listener] of listeners) target.addEventListener(type, listener, capture);
  const unsubscribe = subscribeActivity?.(() => { refreshActivity(true); });
  refreshActivity();
  return {
    refreshActivity,
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const [target, type, listener] of listeners) target.removeEventListener(type, listener, capture);
      unsubscribe?.();
      suspend(binding, now()); binding = null; active = false;
    },
  };
}
