import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { CapsuleCollider, RigidBody, useRapier, type RapierCollider, type RapierRigidBody } from "@react-three/rapier";
import type { KinematicCharacterController } from "@dimforge/rapier3d-compat";
import { Vector3 } from "three";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import { usePlayerInputStore } from "../stores/usePlayerInputStore";
import type { PlayerPoseRef } from "./playerTypes";
import { resetPlayerKeys, usePlayerControls } from "./playerInput";
import {
  PLAYER_ACCELERATION, PLAYER_FOOT_OFFSET, PLAYER_GRAVITY, PLAYER_GROUND_CLEARANCE,
  PLAYER_GROUND_SNAP, PLAYER_HALF_HEIGHT, PLAYER_KCC_OFFSET, PLAYER_MAX_FALL_SPEED,
  PLAYER_MIN_STEP_WIDTH, PLAYER_RADIUS, PLAYER_SLIDE_LIMIT_RADIANS,
  PLAYER_SLOPE_LIMIT_RADIANS, PLAYER_SPEED, PLAYER_STEP_HEIGHT,
  groundedBodyHeight, playerFrameDelta, requestedMovementMagnitude,
} from "./playerMovement";

/** Physical movement only. Presentation supplies a speed; narrative accepts travel elsewhere. */
export function PlayerController({ enabled, movementEnabled, cameraReadyRef, initialPosition, sampleGroundY, movementSpeed, pose, inputActive }: {
  enabled: boolean; movementEnabled: boolean; cameraReadyRef: { current: boolean };
  initialPosition: Vector3Tuple; sampleGroundY: (x: number, z: number) => number;
  movementSpeed: () => number; pose: PlayerPoseRef; inputActive: () => boolean;
}) {
  const { camera } = useThree();
  const { world } = useRapier();
  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<RapierCollider>(null);
  const controllerRef = useRef<KinematicCharacterController | null>(null);
  const hasSpawnedRef = useRef(false);
  // Spawn belongs to this mount; live terrain and saved-position updates must not
  // reapply Rapier's declarative transform to an already walking body.
  const spawnPosition = useRef<Vector3Tuple>([...initialPosition]).current;
  const keysRef = usePlayerControls(enabled && movementEnabled);
  const horizontalVelocityRef = useRef(new Vector3());
  const targetVelocityRef = useRef(new Vector3());
  const desiredMoveRef = useRef(new Vector3());
  const forwardRef = useRef(new Vector3());
  const rightRef = useRef(new Vector3());
  const verticalVelocityRef = useRef(0);
  const groundProbeRef = useRef({ x: Number.NaN, z: Number.NaN, y: spawnPosition[1] - PLAYER_FOOT_OFFSET - PLAYER_GROUND_CLEARANCE });
  const groundProbeTimerRef = useRef(0);

  useEffect(() => {
    const controller = world.createCharacterController(PLAYER_KCC_OFFSET);
    controller.setUp({ x: 0, y: 1, z: 0 });
    controller.enableAutostep(PLAYER_STEP_HEIGHT, PLAYER_MIN_STEP_WIDTH, true);
    controller.enableSnapToGround(PLAYER_GROUND_SNAP);
    controller.setMaxSlopeClimbAngle(PLAYER_SLOPE_LIMIT_RADIANS);
    controller.setMinSlopeSlideAngle(PLAYER_SLIDE_LIMIT_RADIANS);
    controllerRef.current = controller;
    return () => { world.removeCharacterController(controller); controllerRef.current = null; pose.current.available = false; };
  }, [world, pose]);

  useEffect(() => {
    const body = bodyRef.current;
    if (!body || hasSpawnedRef.current) return;
    const spawn = { x: spawnPosition[0], y: spawnPosition[1], z: spawnPosition[2] };
    body.setTranslation(spawn, true);
    body.setNextKinematicTranslation(spawn);
    Object.assign(pose.current.position, spawn);
    pose.current.available = true;
    verticalVelocityRef.current = 0;
    groundProbeRef.current = { x: spawn.x, z: spawn.z, y: spawn.y - PLAYER_FOOT_OFFSET - PLAYER_GROUND_CLEARANCE };
    groundProbeTimerRef.current = 0;
    hasSpawnedRef.current = true;
  }, [spawnPosition, pose]);

  useEffect(() => {
    if (!enabled || !movementEnabled) {
      usePlayerInputStore.getState().reset();
      horizontalVelocityRef.current.set(0, 0, 0);
      targetVelocityRef.current.set(0, 0, 0);
      desiredMoveRef.current.set(0, 0, 0);
      verticalVelocityRef.current = 0;
      pose.current.speedRatio = 0;
    }
  }, [enabled, movementEnabled, pose]);

  // After the shared presentation clock (-3), before the sole camera writer (-1).
  useFrame((_, delta) => {
    const body = bodyRef.current, collider = colliderRef.current, controller = controllerRef.current;
    if (!body || !collider || !controller) return;
    const current = body.translation();
    const output = pose.current;
    output.available = true;
    Object.assign(output.position, current);
    if (!inputActive()) {
      resetPlayerKeys(keysRef.current);
      horizontalVelocityRef.current.set(0, 0, 0);
      verticalVelocityRef.current = 0;
      const input = usePlayerInputStore.getState();
      if (input.moveX || input.moveZ || input.lookX || input.lookY) input.reset();
      output.speedRatio = 0;
      return;
    }
    if (!enabled || !movementEnabled || !cameraReadyRef.current) { output.speedRatio = 0; return; }
    const step = playerFrameDelta(delta);
    if (step === 0) return;
    const keys = keysRef.current;
    const forward = forwardRef.current, right = rightRef.current;
    const targetVelocity = targetVelocityRef.current.set(0, 0, 0);
    const horizontalVelocity = horizontalVelocityRef.current;
    const mobileInput = usePlayerInputStore.getState();
    camera.getWorldDirection(forward);
    forward.y = 0;
    if (forward.lengthSq() > 0.0001) forward.normalize();
    right.copy(forward).cross(camera.up);
    if (right.lengthSq() > 0.0001) right.normalize();
    if (keys.forward) targetVelocity.add(forward);
    if (keys.backward) targetVelocity.addScaledVector(forward, -1);
    if (keys.right) targetVelocity.add(right);
    if (keys.left) targetVelocity.addScaledVector(right, -1);
    if (mobileInput.moveZ !== 0) targetVelocity.addScaledVector(forward, mobileInput.moveZ);
    if (mobileInput.moveX !== 0) targetVelocity.addScaledVector(right, mobileInput.moveX);
    const requestedMagnitude = requestedMovementMagnitude(keys.forward || keys.backward || keys.right || keys.left, mobileInput.moveX, mobileInput.moveZ);
    if (targetVelocity.lengthSq() > 0.0001) targetVelocity.normalize().multiplyScalar(movementSpeed() * requestedMagnitude);
    horizontalVelocity.lerp(targetVelocity, 1 - Math.exp(-step * PLAYER_ACCELERATION));
    verticalVelocityRef.current = Math.max(verticalVelocityRef.current - PLAYER_GRAVITY * step, -PLAYER_MAX_FALL_SPEED);
    const desiredMove = desiredMoveRef.current.set(horizontalVelocity.x * step, verticalVelocityRef.current * step, horizontalVelocity.z * step);
    controller.computeColliderMovement(collider, { x: desiredMove.x, y: desiredMove.y, z: desiredMove.z });
    const corrected = controller.computedMovement();
    if (controller.computedGrounded()) verticalVelocityRef.current = Math.max(0, verticalVelocityRef.current);
    const next = { x: current.x + corrected.x, y: current.y + corrected.y, z: current.z + corrected.z };
    groundProbeTimerRef.current += step;
    const cachedGround = groundProbeRef.current;
    const probeDx = next.x - cachedGround.x, probeDz = next.z - cachedGround.z;
    if (!Number.isFinite(cachedGround.y) || probeDx * probeDx + probeDz * probeDz > 0.18 || groundProbeTimerRef.current >= 0.065) {
      cachedGround.x = next.x; cachedGround.z = next.z; cachedGround.y = sampleGroundY(next.x, next.z); groundProbeTimerRef.current = 0;
    }
    const support = groundedBodyHeight({ bodyY: next.y, groundY: cachedGround.y, verticalVelocity: verticalVelocityRef.current,
      grounded: controller.computedGrounded(), moving: horizontalVelocity.lengthSq() > 0.0001 });
    next.y = support.bodyY;
    if (support.snap) verticalVelocityRef.current = 0;
    body.setNextKinematicTranslation(next);
    Object.assign(output.position, next);
    output.speedRatio = Math.max(0, Math.min(1, horizontalVelocity.length() / PLAYER_SPEED));
  }, -2);

  return <RigidBody ref={bodyRef} type="kinematicPosition" position={spawnPosition} colliders={false} lockRotations canSleep={false}>
    <CapsuleCollider ref={colliderRef} args={[PLAYER_HALF_HEIGHT, PLAYER_RADIUS]} position={[0, 0, 0]} friction={0} restitution={0} />
  </RigidBody>;
}
