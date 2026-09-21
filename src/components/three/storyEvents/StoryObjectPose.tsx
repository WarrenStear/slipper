import { useLayoutEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StoryObjectDefinition } from "../../../storyEvents/storyEventTypes";
import { houseResetDuration, smoothPresentationProgress } from "../../../lib/scenePolishRuntime";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";

/** The authored outcome is durable; the journey back to that pose is not. */
export function StoryObjectPose({ object, state, position, placementId, reducedMotion, children }: {
  object: StoryObjectDefinition; state?: string; position: [number, number, number];
  placementId?: string; reducedMotion: boolean; children: ReactNode;
}) {
  const root = useRef<THREE.Group>(null);
  const initial = useRef<[number, number, number]>([...position]);
  const previousState = useRef(state);
  const from = useMemo(() => new THREE.Vector3(...position), []);
  const target = useMemo(() => new THREE.Vector3(...position), []);
  const timing = useRef({ elapsed: 0, duration: 0 });
  const [x, y, z] = position;
  const houseObject = object.id === "thorn-house.chair" || object.id === "thorn-house.frame";
  const previousPlacement = houseObject && state === "reset" ? object.targets?.find(item => item.id === placementId) : undefined;

  useLayoutEffect(() => {
    if (!root.current) return;
    from.copy(root.current.position);
    target.set(x, y, z);
    timing.current = { elapsed: 0, duration: houseResetDuration(object.id, previousState.current, state, reducedMotion) };
    previousState.current = state;
    if (timing.current.duration === 0) root.current.position.copy(target);
    root.current.userData.storyPresentationSettled = timing.current.duration === 0;
  }, [object.id, state, x, y, z, reducedMotion, from, target]);

  useFrame((_, delta) => {
    if (!root.current || timing.current.duration === 0) return;
    if (document.hidden || !document.hasFocus() || useSettingsStore.getState().drawerOpen || useWorldStore.getState().mode !== "explore") return;
    timing.current.elapsed += Math.min(delta, .1);
    const progress = smoothPresentationProgress(timing.current.elapsed, timing.current.duration);
    root.current.position.lerpVectors(from, target, progress);
    root.current.userData.storyPresentationSettled = progress === 1;
    if (progress === 1) timing.current.duration = 0;
  });

  return <>
    <group ref={root} name={`story-object:${object.id}`} position={initial.current} userData={{ objectId: object.id, state: state ?? "untouched" }}>
      {children}
      <StoryObjectIdentity objectId={object.id} />
    </group>
    {previousPlacement ? <group name={`house-placement-trace:${object.id}`} position={previousPlacement.localPosition} userData={{ rememberedPlacement: placementId }}>
      <mesh position={[0, -.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[.29, .305, 4]} />
        <meshBasicMaterial color="#b9a588" transparent opacity={.25} depthWrite={false} />
      </mesh>
    </group> : null}
  </>;
}

/** Small fixed marks make the same displaced prop recognisable in hand and room. */
export function StoryObjectIdentity({ objectId }: { objectId: string }) {
  if (objectId === "thorn-house.chair") return <group name="house-chair-carved-mark" position={[0, 1.12, .209]}>
    {[-.06, .02, .08].map((x, i) => <mesh key={x} position={[x, i * .012, 0]} rotation={[0, 0, -.24]}><boxGeometry args={[.012, .12 - i * .015, .006]} /><meshStandardMaterial color="#b79a76" roughness={1} /></mesh>)}
  </group>;
  if (objectId === "thorn-house.frame") return <group name="house-frame-worn-corner" position={[-.46, 1.36, -.075]}>
    <mesh><boxGeometry args={[.19, .035, .009]} /><meshStandardMaterial color="#b7a084" roughness={1} /></mesh>
    <mesh position={[-.075, -.07, 0]}><boxGeometry args={[.035, .17, .009]} /><meshStandardMaterial color="#b7a084" roughness={1} /></mesh>
  </group>;
  return null;
}
