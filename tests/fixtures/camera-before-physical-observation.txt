import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Euler, MathUtils, PerspectiveCamera, Vector3 } from "three";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import { usePlayerInputStore } from "../stores/usePlayerInputStore";
import type { ExperienceMode, PlayerControls, PlayerPoseRef } from "./playerTypes";
import { playerFrameDelta } from "./playerMovement";
import { claimCameraAuthority } from "./cameraOwnership";
import { useCameraAssistance } from "./useCameraAssistance";
import {
  HEAD_BOB_FREQUENCY, PLAYER_CAMERA_OFFSET_Y, cameraFrameAuthority, cameraHeadBob,
  cameraLookPitch, resolveCameraArrival,
} from "./cameraModel";

function readReducedExperiencePreferences() {
  if (typeof document === "undefined") return { reducedMotion: false, reducedEffects: false };
  const root = document.documentElement;
  return {
    reducedMotion: root.dataset.motion === "reduced" || root.classList.contains("sidtw-reduced-motion"),
    reducedEffects: root.dataset.effects === "reduced" || root.classList.contains("sidtw-reduced-effects"),
  };
}

/** Desktop input queues deltas; only the camera frame applies the look. */
function usePointerLockLookInput(enabled: boolean, pending: { current: { x: number; y: number } }, inputActive: () => boolean) {
  const { gl } = useThree();
  useEffect(() => {
    if (!enabled) return;
    const touchLikeInput = document.documentElement.dataset.mobile === "true" || window.matchMedia?.("(pointer: coarse)").matches === true;
    if (touchLikeInput) return;
    const pointerLockAvailable = "pointerLockElement" in document && navigator.webdriver !== true && typeof document.documentElement.requestPointerLock === "function";
    const canvas = gl.domElement;
    const requestPointerLock = canvas.requestPointerLock?.bind(canvas);
    if (!pointerLockAvailable || !requestPointerLock) return;
    const reset = () => { pending.current.x = 0; pending.current.y = 0; };
    const handleCanvasClick = () => {
      if (!inputActive() || document.pointerLockElement === canvas) return;
      try {
        const result = requestPointerLock();
        if (result && typeof result.catch === "function") result.catch(() => undefined);
      } catch { /* Embedded preview browsers may expose and deny the API. */ }
    };
    const handleMouseMove = (event: MouseEvent) => {
      if (!inputActive() || document.pointerLockElement !== canvas) return;
      pending.current.x += event.movementX;
      pending.current.y += event.movementY;
    };
    const lockChange = () => { if (document.pointerLockElement !== canvas) reset(); };
    const visibility = () => { if (document.hidden) reset(); };
    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("pointerlockchange", lockChange);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", reset);
    window.addEventListener("pagehide", reset);
    return () => {
      reset();
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("pointerlockchange", lockChange);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pagehide", reset);
      if (document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
  }, [enabled, gl, inputActive, pending]);
}

/** The live world's sole camera authority, after physics and before visual consumers. */
export function CameraController({ mode, controls, movementEnabled, cameraReadyRef, pose, activePosition, playerInitialPosition,
  cameraStart, cameraTarget, fov, guidanceLookTarget, lowView, bobSuppression, reducedMotion, reducedEffects,
  sceneId, cameraAssistance, openingShotOwned, presentationActive, inputActive }: {
  mode: ExperienceMode; controls: PlayerControls; movementEnabled: boolean; cameraReadyRef: { current: boolean }; pose: PlayerPoseRef;
  activePosition: Vector3Tuple; playerInitialPosition: Vector3Tuple; cameraStart: Vector3Tuple; cameraTarget: Vector3Tuple;
  fov: number; guidanceLookTarget: Vector3Tuple | null; lowView: boolean; bobSuppression: number;
  reducedMotion: boolean; reducedEffects: boolean; sceneId: string | null; cameraAssistance: boolean;
  openingShotOwned: boolean; presentationActive: () => boolean; inputActive: () => boolean;
}) {
  const { camera } = useThree();
  const walkMode = mode === "explore" && controls === "walk";
  const progressRef = useRef(0);
  const hasInitialisedRef = useRef(false);
  const fromRef = useRef(new Vector3()), toRef = useRef(new Vector3()), lookAtRef = useRef(new Vector3());
  const lookRotationRef = useRef(new Euler(0, 0, 0, "YXZ"));
  const lookDeltaRef = useRef({ x: 0, y: 0 });
  const desktopLookRef = useRef({ x: 0, y: 0 });
  const bobPhaseRef = useRef(0);
  const cameraHeightRef = useRef(lowView ? .08 : PLAYER_CAMERA_OFFSET_Y);
  const reducedPreferencesRef = useRef(readReducedExperiencePreferences());
  const arrival = useMemo(() => resolveCameraArrival({ mode, controls, activePosition, playerInitialPosition,
    cameraStart, cameraTarget, guidanceLookTarget, lowView }), [mode, controls, activePosition, playerInitialPosition, cameraStart, cameraTarget, guidanceLookTarget, lowView]);
  usePointerLockLookInput(walkMode, desktopLookRef, inputActive);
  const applyCameraAssistance = useCameraAssistance({ sceneId, cameraAssistance, reducedMotion, focusPosition: guidanceLookTarget,
    openingOwned: openingShotOwned, isActive: presentationActive });

  useLayoutEffect(() => claimCameraAuthority(camera), [camera]);

  useEffect(() => {
    const root = document.documentElement;
    const sync = () => { reducedPreferencesRef.current = readReducedExperiencePreferences(); };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class", "data-motion", "data-effects"] });
    sync();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (hasInitialisedRef.current) { cameraReadyRef.current = progressRef.current >= 1; return; }
    cameraReadyRef.current = false;
    progressRef.current = 0;
    fromRef.current.set(...arrival.from);
    toRef.current.set(...arrival.to);
    lookAtRef.current.set(...arrival.focus);
    camera.position.copy(fromRef.current);
    camera.lookAt(lookAtRef.current);
    if (camera instanceof PerspectiveCamera) {
      camera.fov = mode === "read" ? Math.max(52, fov - 8) : fov;
      camera.updateProjectionMatrix();
    }
    if (reducedMotion) {
      camera.position.copy(toRef.current); camera.lookAt(lookAtRef.current);
      progressRef.current = 1; cameraReadyRef.current = true;
    }
    hasInitialisedRef.current = true;
  }, [arrival, camera, cameraReadyRef, fov, mode, reducedMotion]);

  useFrame((_, delta) => {
    if (!inputActive()) {
      desktopLookRef.current.x = 0; desktopLookRef.current.y = 0;
      usePlayerInputStore.getState().consumeLookDelta(lookDeltaRef.current);
      applyCameraAssistance(camera, delta);
      return;
    }
    const step = playerFrameDelta(delta);
    const preferences = reducedPreferencesRef.current;
    const motionReduced = reducedMotion || preferences.reducedMotion;
    const effectsReduced = reducedEffects || preferences.reducedEffects;
    const authority = cameraFrameAuthority(progressRef.current, walkMode, pose.current.available);
    if (authority === "arrival") {
      desktopLookRef.current.x = 0; desktopLookRef.current.y = 0;
      usePlayerInputStore.getState().consumeLookDelta(lookDeltaRef.current);
      progressRef.current = motionReduced ? 1 : Math.min(1, progressRef.current + step * 1.85);
      const eased = 1 - Math.pow(1 - progressRef.current, 3);
      camera.position.lerpVectors(fromRef.current, toRef.current, eased);
      camera.lookAt(lookAtRef.current);
      cameraReadyRef.current = progressRef.current >= 1;
      return;
    }
    cameraReadyRef.current = true;
    if (authority === "player") {
      const targetHeight = lowView ? .08 : PLAYER_CAMERA_OFFSET_Y;
      cameraHeightRef.current = MathUtils.lerp(cameraHeightRef.current, targetHeight, 1 - Math.exp(-step * (movementEnabled ? 1.45 : 4.2)));
      const mobileInput = usePlayerInputStore.getState();
      const lookDelta = mobileInput.consumeLookDelta(lookDeltaRef.current);
      const desktop = desktopLookRef.current;
      if (lookDelta.x !== 0 || lookDelta.y !== 0 || desktop.x !== 0 || desktop.y !== 0) {
        const rotation = lookRotationRef.current.setFromQuaternion(camera.quaternion, "YXZ");
        const mobileSensitivity = .0032 * (motionReduced ? .72 : 1);
        rotation.y -= lookDelta.x * mobileSensitivity + desktop.x * .0019;
        rotation.x = cameraLookPitch(rotation.x, lookDelta.y, mobileSensitivity);
        rotation.x = cameraLookPitch(rotation.x, desktop.y, .0019);
        camera.quaternion.setFromEuler(rotation);
        desktop.x = 0; desktop.y = 0;
      }
      const speedRatio = movementEnabled ? pose.current.speedRatio : 0;
      if (movementEnabled) bobPhaseRef.current += step * HEAD_BOB_FREQUENCY * (.22 + speedRatio);
      const bob = cameraHeadBob(bobPhaseRef.current, speedRatio, bobSuppression, motionReduced, effectsReduced);
      const position = pose.current.position;
      camera.position.set(position.x, position.y + cameraHeightRef.current + bob, position.z);
    }
    applyCameraAssistance(camera, delta);
  }, -1);

  // Orbit remains an explicit view within this authority and never competes with body follow.
  return mode === "explore" && controls === "orbit" ? <OrbitControls
    enablePan={false} enableZoom={false} rotateSpeed={.42} dampingFactor={.08} enableDamping
    minPolarAngle={Math.PI * .22} maxPolarAngle={Math.PI * .78}
  /> : null;
}
