/** Bounded presentation math; nothing here grants events or enters a save. */
export type ReflectionPose = { x: number; y: number; yaw: number };
const CAPACITY = 128;
const STRIDE = 4;
export type ReflectionHistory = { data: Float64Array; head: number; count: number };
export function createReflectionHistory(): ReflectionHistory {
  return { data: new Float64Array(CAPACITY * STRIDE), head: 0, count: 0 };
}
export function resetReflectionHistory(history: ReflectionHistory) { history.head = 0; history.count = 0; }
export function recordReflectionPose(history: ReflectionHistory, now: number, pose: ReflectionPose) {
  if (!Number.isFinite(now) || !Number.isFinite(pose.x) || !Number.isFinite(pose.y) || !Number.isFinite(pose.yaw)) return;
  if (history.count) {
    const last = ((history.head - 1 + CAPACITY) % CAPACITY) * STRIDE;
    const gap = now - history.data[last];
    if (gap < 0 || gap > 1000) resetReflectionHistory(history);
    else if (gap < 30) return;
  }
  const offset = history.head * STRIDE;
  history.data[offset] = now; history.data[offset + 1] = pose.x;
  history.data[offset + 2] = pose.y; history.data[offset + 3] = pose.yaw;
  history.head = (history.head + 1) % CAPACITY;
  history.count = Math.min(CAPACITY, history.count + 1);
}
function copyPose(history: ReflectionHistory, offset: number, out: ReflectionPose) {
  out.x = history.data[offset + 1]; out.y = history.data[offset + 2]; out.yaw = history.data[offset + 3];
  return out;
}
/** Writes into caller-owned storage, interpolating angles across the short arc. */
export function sampleReflectionPose(history: ReflectionHistory, now: number, delayMs: number, out: ReflectionPose) {
  if (!history.count || !Number.isFinite(now) || !Number.isFinite(delayMs)) return false;
  const requested = now - Math.max(0, delayMs);
  const newest = ((history.head - 1 + CAPACITY) % CAPACITY) * STRIDE;
  if (requested >= history.data[newest]) { copyPose(history, newest, out); return true; }
  const oldest = (history.head - history.count + CAPACITY) % CAPACITY;
  let previous = oldest * STRIDE;
  if (requested <= history.data[previous]) { copyPose(history, previous, out); return true; }
  for (let i = 1; i < history.count; i++) {
    const next = ((oldest + i) % CAPACITY) * STRIDE;
    if (history.data[next] >= requested) {
      const span = history.data[next] - history.data[previous];
      const t = span > 0 ? (requested - history.data[previous]) / span : 0;
      out.x = history.data[previous + 1] + (history.data[next + 1] - history.data[previous + 1]) * t;
      out.y = history.data[previous + 2] + (history.data[next + 2] - history.data[previous + 2]) * t;
      const angle = history.data[next + 3] - history.data[previous + 3];
      out.yaw = history.data[previous + 3] + Math.atan2(Math.sin(angle), Math.cos(angle)) * t;
      return true;
    }
    previous = next;
  }
  copyPose(history, previous, out); return true;
}

export function houseResetDuration(objectId: string, previousState: string | undefined, state: string | undefined, reducedMotion: boolean) {
  return !reducedMotion && (objectId === "thorn-house.chair" || objectId === "thorn-house.frame")
    && previousState === "placed" && state === "reset" ? 2.4 : 0;
}
export function smoothPresentationProgress(elapsed: number, duration: number) {
  if (!Number.isFinite(duration) || duration <= 0) return 1;
  const t = Math.max(0, Math.min(1, Number.isFinite(elapsed) ? elapsed / duration : 0));
  return t * t * (3 - 2 * t);
}
