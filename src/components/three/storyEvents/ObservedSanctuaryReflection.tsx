import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { createReflectionHistory, recordReflectionPose, resetReflectionHistory, sampleReflectionPose } from "../../../lib/scenePolishRuntime";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import { ReflectionApparition } from "../reflections/ReflectionApparition";
import { ReflectivePanel } from "../chapters/ChapterPrimitives";

/** A bounded delayed witness silhouette, not a second camera or render target. */
export function ObservedSanctuaryReflection({ delayed, reducedMotion }: { delayed: boolean; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null);
  const reflected = useRef<THREE.Group>(null);
  const history = useMemo(createReflectionHistory, []);
  const viewer = useMemo(() => new THREE.Vector3(), []);
  const direction = useMemo(() => new THREE.Vector3(), []);
  const rotation = useMemo(() => new THREE.Quaternion(), []);
  const live = useRef({ x: 0, y: 0, yaw: 0 });
  const sampled = useRef({ x: 0, y: 0, yaw: 0 });
  useFrame(({ camera }) => {
    if (!root.current || !reflected.current) return;
    if (document.hidden || !document.hasFocus() || useSettingsStore.getState().drawerOpen || useWorldStore.getState().mode !== "explore") {
      resetReflectionHistory(history); return;
    }
    root.current.worldToLocal(viewer.copy(camera.position));
    camera.getWorldDirection(direction);
    root.current.getWorldQuaternion(rotation).invert();
    direction.applyQuaternion(rotation);
    const pose = live.current;
    pose.x = THREE.MathUtils.clamp(-viewer.x * .15, -.65, .65);
    pose.y = THREE.MathUtils.clamp((viewer.y + 1) * .12, -.18, .18);
    pose.yaw = THREE.MathUtils.clamp(-Math.atan2(direction.x, Math.abs(direction.z)), -.4, .4);
    const now = performance.now();
    recordReflectionPose(history, now, pose);
    const delayMs = delayed && !reducedMotion ? 800 : 0;
    if (!sampleReflectionPose(history, now, delayMs, sampled.current)) return;
    // Stable framing in reduced motion. The reflected lock remains a non-motion
    // expression of the same contradiction; the camera is never moved here.
    reflected.current.position.x = reducedMotion ? 0 : sampled.current.x;
    reflected.current.position.y = reducedMotion ? -.3 : -.3 + sampled.current.y;
    reflected.current.rotation.y = reducedMotion ? 0 : sampled.current.yaw;
    root.current.userData.delayMs = delayMs;
    root.current.userData.sampleCount = history.count;
  });
  return <group ref={root} name="blue-moon-delayed-reflection" position={[-2.9, 2.7, 5.25]} rotation={[0, Math.PI, 0]} userData={{ reflectionMode: "observed-pose", delayMs: delayed && !reducedMotion ? 800 : 0 }}>
    <ReflectivePanel position={[0, 0, 0]} size={[2.4, 4.3]} />
    <group ref={reflected} name="delayed-viewer-silhouette" position={[0, -.3, .17]}>
      <group position={[0, -.86, 0]} scale={1.15}><ReflectionApparition /></group>
    </group>
    {delayed ? <group name="lock-visible-only-in-reflection" position={[.48, -.2, .21]}>
      <mesh><ringGeometry args={[.1, .15, 14]} /><meshBasicMaterial color="#d5dbe2" toneMapped={false} /></mesh>
      <mesh position={[0, -.18, 0]}><boxGeometry args={[.08, .24, .035]} /><meshBasicMaterial color="#d5dbe2" toneMapped={false} /></mesh>
    </group> : null}
  </group>;
}
