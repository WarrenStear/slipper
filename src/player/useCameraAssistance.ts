import { useEffect, useMemo, useRef } from "react";
import { Matrix4, PerspectiveCamera, Quaternion, Vector3, type Camera } from "three";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import { getCurrentCinematicProfile, resolveCameraAttraction } from "../cinematics/emotionalCinematography";
import { advanceShotSettle, createShotSettle, resetShotSettle, settleLens, shotAimOffset, shotComposition, shotLens, shotLensHeld } from "../cinematics/shotComposition";
import { usePlayerInputStore } from "../stores/usePlayerInputStore";

/** Apply authored lens/aim only when the camera owner explicitly invites it. */
export function useCameraAssistance({ sceneId, cameraAssistance, reducedMotion, focusPosition, openingOwned, isActive }: {
  sceneId: string | null; cameraAssistance: boolean; reducedMotion: boolean; focusPosition?: Vector3Tuple | null;
  openingOwned: boolean; isActive: () => boolean;
}) {
  const lastInput = useRef(0);
  const heldKeys = useRef(new Set<string>());
  const heldPointers = useRef(new Set<number>());
  const settle = useRef(createShotSettle());
  const previousTarget = useRef<Vector3Tuple | null>(null);
  const scratch = useMemo(() => ({ target: new Vector3(), direction: new Vector3(), forward: new Vector3(), right: new Vector3(), up: new Vector3(), matrix: new Matrix4(), rotation: new Quaternion() }), []);
  useEffect(() => {
    const noteInput = () => { lastInput.current = performance.now(); resetShotSettle(settle.current); };
    const keydown = (event: KeyboardEvent) => { heldKeys.current.add(event.code); noteInput(); };
    const keyup = (event: KeyboardEvent) => { heldKeys.current.delete(event.code); noteInput(); };
    const pointerdown = (event: PointerEvent) => { heldPointers.current.add(event.pointerId); noteInput(); };
    const pointerup = (event: PointerEvent) => { heldPointers.current.delete(event.pointerId); noteInput(); };
    const suspend = () => { heldKeys.current.clear(); heldPointers.current.clear(); noteInput(); };
    const visibility = () => { if (document.hidden) suspend(); else noteInput(); };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("pointermove", noteInput, { passive: true });
    window.addEventListener("pointerdown", pointerdown, { passive: true });
    window.addEventListener("pointerup", pointerup, { passive: true });
    window.addEventListener("pointercancel", pointerup, { passive: true });
    window.addEventListener("wheel", noteInput, { passive: true });
    window.addEventListener("blur", suspend);
    window.addEventListener("focus", noteInput);
    window.addEventListener("pagehide", suspend);
    window.addEventListener("pageshow", noteInput);
    document.addEventListener("visibilitychange", visibility);
    const unsubscribe = usePlayerInputStore.subscribe(state => {
      if (Math.abs(state.moveX) + Math.abs(state.moveZ) + Math.abs(state.lookX) + Math.abs(state.lookY) > .001) noteInput();
    });
    noteInput(); previousTarget.current = null;
    return () => {
      window.removeEventListener("keydown", keydown); window.removeEventListener("keyup", keyup);
      window.removeEventListener("pointermove", noteInput); window.removeEventListener("pointerdown", pointerdown);
      window.removeEventListener("pointerup", pointerup); window.removeEventListener("pointercancel", pointerup);
      window.removeEventListener("wheel", noteInput); window.removeEventListener("blur", suspend);
      window.removeEventListener("focus", noteInput); window.removeEventListener("pagehide", suspend);
      window.removeEventListener("pageshow", noteInput);
      document.removeEventListener("visibilitychange", visibility); unsubscribe();
    };
  }, [sceneId]);
  return (camera: Camera, delta: number) => {
    if (!sceneId || !isActive()) {
      lastInput.current = performance.now(); resetShotSettle(settle.current); return;
    }
    // A resumed or stalled frame is not witnessed camera time.
    if (!Number.isFinite(delta) || delta < 0 || delta > .25) {
      lastInput.current = performance.now(); resetShotSettle(settle.current); return;
    }
    const now = performance.now();
    const profile = getCurrentCinematicProfile(), mobile = usePlayerInputStore.getState();
    const inputActive = heldPointers.current.size > 0 || heldKeys.current.size > 0
      || Math.abs(mobile.moveX) + Math.abs(mobile.moveZ) + Math.abs(mobile.lookX) + Math.abs(mobile.lookY) > .001;
    const comfort = reducedMotion || !cameraAssistance;
    if (inputActive) { lastInput.current = performance.now(); resetShotSettle(settle.current); }
    if (camera instanceof PerspectiveCamera) {
      // The opening keeps its own shot. Comfort mode removes lens animation entirely.
      const desired = comfort ? 65 : openingOwned ? profile.fov : shotLens(sceneId, profile.fov, camera.aspect);
      const next = comfort ? desired : shotLensHeld(inputActive, now, lastInput.current) ? camera.fov : settleLens(camera.fov, desired, delta);
      if (Math.abs(next - camera.fov) > .0005) { camera.fov = next; camera.updateProjectionMatrix(); }
    }
    if (comfort || openingOwned || !focusPosition || !focusPosition.every(Number.isFinite)) { resetShotSettle(settle.current); return; }
    const previous = previousTarget.current;
    if (!previous || focusPosition.some((value, i) => Math.abs(value - previous[i]) > .25)) {
      previousTarget.current = [...focusPosition]; lastInput.current = performance.now(); resetShotSettle(settle.current);
    }
    scratch.target.set(...focusPosition); scratch.target.y += profile.framingBias;
    scratch.direction.copy(scratch.target).sub(camera.position);
    const distance = scratch.direction.length();
    if (distance < .75 || distance > 30) return;
    scratch.direction.normalize(); camera.getWorldDirection(scratch.forward);
    const speed = resolveCameraAttraction({ assistance: cameraAssistance, reducedMotion,
      secondsSinceInput: (performance.now() - lastInput.current) / 1000, inputActive,
      attraction: profile.gazeAttraction, facingDot: scratch.forward.dot(scratch.direction) });
    const step = advanceShotSettle(settle.current, delta, speed, !inputActive, shotComposition(sceneId).maxTurn);
    if (step === 0) return;
    const [x, y] = shotAimOffset(sceneId, distance, camera instanceof PerspectiveCamera ? camera.fov : 65, camera instanceof PerspectiveCamera ? camera.aspect : 1);
    scratch.right.set(1, 0, 0).applyQuaternion(camera.quaternion);
    scratch.up.copy(camera.up).normalize();
    scratch.target.addScaledVector(scratch.right, x).addScaledVector(scratch.up, y);
    scratch.matrix.lookAt(camera.position, scratch.target, camera.up);
    scratch.rotation.setFromRotationMatrix(scratch.matrix);
    camera.quaternion.rotateTowards(scratch.rotation, step);
  };
}
