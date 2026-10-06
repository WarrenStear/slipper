/** Renderer-free physical facts. No scene IDs, progression, stores or clocks. */
export type PhysicalObservationLease = object;
export type NumericPosition = readonly [number, number, number];
export type NumericOrientation = readonly [number, number, number, number];
export type PhysicalPoseSample = Readonly<{
  observedAtMs: number;
  position: NumericPosition;
  quaternion: NumericOrientation;
  inputEnabled: boolean;
  settled: boolean;
}>;
export type PhysicalObservationFacts = Readonly<{
  revision: number;
  observedAtMs: number | null;
  dtMs: number;
  position: NumericPosition;
  quaternion: NumericOrientation;
  displacement: number;
  angularDisplacement: number;
  linearSpeed: number;
  angularSpeed: number;
  available: boolean;
  fresh: boolean;
  inputEnabled: boolean;
  settled: boolean;
  heldKeys: number;
  heldPointers: number;
  idleMs: number;
  stillEligible: boolean;
}>;

// The former >=75ms accumulator reset produced 100/83.33/75ms windows at
// 30/60/120Hz. Fixed .03m and (1-|quaternion dot|)<.00008 limits therefore
// admitted .30/.36/.40m/s and 14.49/17.39/19.33 degrees/s respectively.
// Normalize to the intended 75ms interval, rather than preserving FPS bias.
export const PHYSICAL_STILL_LINEAR_SPEED = .03 / .075;
export const PHYSICAL_STILL_ANGULAR_SPEED = 2 * Math.acos(1 - .00008) / .075;
export const PHYSICAL_INPUT_IDLE_MS = 350;
// Match the existing attention clock's interruption boundary, including its
// valid <=1000ms low-rate samples. The runtime consumes observedAtMs/revision.
export const PHYSICAL_POSE_MAX_AGE_MS = 1000;

const validTime = (value: number) => Number.isFinite(value) && value >= 0;

/** A local reference port. The caller supplies an opaque lifetime token;
 * replacing/releasing it invalidates queued publishers and readers together.
 * The DOM runtime owns that lease and attention time. A frame only publishes.
 */
export function createPhysicalObservationPort() {
  let lease: PhysicalObservationLease | null = null;
  let primed = false, motionAvailable = false, inputEnabled = false, settled = false;
  let observedAtMs: number | null = null;
  let lastActivityMs = 0, revision = 0;
  let dtMs = 0, displacement = 0, angularDisplacement = 0, linearSpeed = 0, angularSpeed = 0;
  const position = new Float64Array(3), quaternion = new Float64Array([0, 0, 0, 1]);
  const nextQuaternion = new Float64Array(4);
  const keys = new Set<string>(), pointers = new Set<number>();
  const current = (token: PhysicalObservationLease) => lease !== null && lease === token;
  const clearMotion = () => { primed = false; motionAvailable = false; dtMs = displacement = angularDisplacement = linearSpeed = angularSpeed = 0; };
  const activity = (nowMs: number) => { lastActivityMs = Math.max(lastActivityMs, nowMs); };

  return {
    bind(token: PhysicalObservationLease, nowMs: number) {
      if (!token || typeof token !== "object" || !validTime(nowMs)) return false;
      lease = token; observedAtMs = null; revision = 0; inputEnabled = settled = false;
      keys.clear(); pointers.clear(); lastActivityMs = nowMs; clearMotion();
      return true;
    },
    release(token: PhysicalObservationLease) {
      if (!current(token)) return false;
      lease = null; keys.clear(); pointers.clear(); clearMotion();
      return true;
    },
    suspend(token: PhysicalObservationLease, nowMs: number) {
      if (!current(token) || !validTime(nowMs)) return false;
      keys.clear(); pointers.clear(); activity(nowMs); inputEnabled = settled = false;
      clearMotion(); revision++;
      return true;
    },
    key(token: PhysicalObservationLease, code: string, held: boolean, nowMs: number) {
      if (!current(token) || typeof code !== "string" || !validTime(nowMs)) return false;
      if (held === true) keys.add(code); else keys.delete(code);
      activity(nowMs); return true;
    },
    pointer(token: PhysicalObservationLease, id: number, held: boolean, nowMs: number) {
      if (!current(token) || !Number.isFinite(id) || !validTime(nowMs)) return false;
      if (held === true) pointers.add(id); else pointers.delete(id);
      activity(nowMs); return true;
    },
    publish(token: PhysicalObservationLease, sample: PhysicalPoseSample) {
      if (!current(token)) return false;
      revision++;
      const nextPosition = sample.position, orientation = sample.quaternion;
      const finite = validTime(sample.observedAtMs) && nextPosition.length === 3
        && Number.isFinite(nextPosition[0]) && Number.isFinite(nextPosition[1]) && Number.isFinite(nextPosition[2])
        && orientation.length === 4 && Number.isFinite(orientation[0]) && Number.isFinite(orientation[1])
        && Number.isFinite(orientation[2]) && Number.isFinite(orientation[3]);
      const scale = finite ? Math.max(Math.abs(orientation[0]), Math.abs(orientation[1]), Math.abs(orientation[2]), Math.abs(orientation[3])) : 0;
      if (!finite || scale === 0 || observedAtMs !== null && sample.observedAtMs <= observedAtMs) { clearMotion(); return false; }
      const length = Math.hypot(orientation[0] / scale, orientation[1] / scale, orientation[2] / scale, orientation[3] / scale);
      for (let i = 0; i < 4; i++) nextQuaternion[i] = orientation[i] / scale / length;
      dtMs = primed && observedAtMs !== null ? sample.observedAtMs - observedAtMs : 0;
      inputEnabled = sample.inputEnabled === true; settled = sample.settled === true;
      motionAvailable = primed && dtMs > 0 && dtMs <= PHYSICAL_POSE_MAX_AGE_MS && inputEnabled && settled;
      if (motionAvailable) {
        displacement = Math.hypot(nextPosition[0] - position[0], nextPosition[1] - position[1], nextPosition[2] - position[2]);
        let dot = 0; for (let i = 0; i < 4; i++) dot += nextQuaternion[i] * quaternion[i];
        angularDisplacement = 2 * Math.acos(Math.max(0, Math.min(1, Math.abs(dot))));
        linearSpeed = displacement * 1000 / dtMs; angularSpeed = angularDisplacement * 1000 / dtMs;
        if (!Number.isFinite(displacement) || !Number.isFinite(angularDisplacement) || !Number.isFinite(linearSpeed) || !Number.isFinite(angularSpeed)) {
          motionAvailable = false; displacement = angularDisplacement = linearSpeed = angularSpeed = 0;
        }
      } else displacement = angularDisplacement = linearSpeed = angularSpeed = 0;
      position.set(nextPosition); quaternion.set(nextQuaternion); observedAtMs = sample.observedAtMs;
      primed = inputEnabled && settled;
      return true;
    },
    read(token: PhysicalObservationLease, nowMs: number): PhysicalObservationFacts | null {
      if (!current(token)) return null;
      const age = observedAtMs === null ? Infinity : nowMs - observedAtMs;
      const fresh = validTime(nowMs) && age >= 0 && age <= PHYSICAL_POSE_MAX_AGE_MS;
      const available = motionAvailable && fresh;
      const idleMs = validTime(nowMs) ? Math.max(0, nowMs - lastActivityMs) : 0;
      return { revision, observedAtMs, dtMs, position: [position[0], position[1], position[2]],
        quaternion: [quaternion[0], quaternion[1], quaternion[2], quaternion[3]], displacement, angularDisplacement, linearSpeed, angularSpeed,
        available, fresh, inputEnabled, settled, heldKeys: keys.size, heldPointers: pointers.size, idleMs,
        stillEligible: available && !keys.size && !pointers.size && idleMs > PHYSICAL_INPUT_IDLE_MS
          && linearSpeed < PHYSICAL_STILL_LINEAR_SPEED && angularSpeed < PHYSICAL_STILL_ANGULAR_SPEED };
    },
  };
}

export type PhysicalObservationPort = ReturnType<typeof createPhysicalObservationPort>;

/** Supplied by the runtime host; a camera never binds or owns this lifetime. */
export type PhysicalObservationBinding = Readonly<{ port: PhysicalObservationPort; lease: PhysicalObservationLease }>;
