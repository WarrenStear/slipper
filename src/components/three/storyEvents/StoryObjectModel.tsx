import { memo, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { StoryObjectKind } from "../../../storyEvents/storyEventTypes";
import { Beam, DoorFrame, KeyProp, LanternProp } from "../chapters/ChapterPrimitives";
import { ClothboundBook, DomesticChair, FoldedPaperBird, MemoryFeather, MemoryRose, StoryLinen, StoryPaper } from "./StoryHeroProps";
import { TactileMaterial } from "./TactileMaterial";

function TactileDoor({ open, reducedMotion }: { open: boolean; reducedMotion: boolean }) {
  const hinge = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (hinge.current) hinge.current.rotation.y = THREE.MathUtils.damp(hinge.current.rotation.y, open ? -1.32 : 0, reducedMotion ? 20 : 2.6, Math.min(delta, .05));
  });
  return <group name="touchable-hinged-door">
    <DoorFrame width={1.5} height={2} depth={.18} open />
    <group ref={hinge} position={[-.72, 0, 0]} rotation={[0, open ? -1.32 : 0, 0]}>
      <mesh position={[.68, .95, 0]}><boxGeometry args={[1.33, 1.86, .09]} /><TactileMaterial surface="wood" color="#66503d" roughness={.84} /></mesh>
      <mesh position={[1.17, .93, -.075]}><sphereGeometry args={[.045, 8, 6]} /><meshStandardMaterial color="#b4a17c" metalness={.7} roughness={.35} /></mesh>
    </group>
  </group>;
}

function SovereignMirrorImage() {
  const image = useRef<THREE.Group>(null);
  const viewer = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera }) => {
    if (!image.current) return;
    viewer.copy(camera.position); image.current.worldToLocal(viewer);
    image.current.visible = viewer.z < -.1 && Math.abs(viewer.x) < 3;
  });
  return <group ref={image} name="crown-visible-only-in-sovereign-mirror" position={[0, .72, -.092]} userData={{ reflectionOnly: true, physicalCrown: false }}>
    <mesh position={[0, .08, 0]} scale={[.13, .17, .001]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#bdc3bd" transparent opacity={.43} /></mesh>
    <mesh position={[0, -.27, 0]} scale={[.27, .43, .001]}><sphereGeometry args={[1, 12, 8]} /><meshBasicMaterial color="#a6b5b4" transparent opacity={.3} /></mesh>
    <group position={[0, .32, -.001]} scale={[.32, .3, .002]}>
      <mesh><boxGeometry args={[.95, .13, .1]} /><meshBasicMaterial color="#d9c68b" /></mesh>
      {[-.34, 0, .34].map((x, i) => <mesh key={x} position={[x, i === 1 ? .29 : .2, 0]}><coneGeometry args={[.15, i === 1 ? .6 : .42, 3]} /><meshBasicMaterial color="#d9c68b" /></mesh>)}
    </group>
  </group>;
}

/** Same object identities and world/hand interface; richer presentation only. */
export const StoryObjectModel = memo(function StoryObjectModel({ kind, state = "idle", reducedMotion = false }: { kind: StoryObjectKind; state?: string; reducedMotion?: boolean }) {
  const burnt = state === "burned" || state === "ash";
  const cream = burnt ? "#28221e" : "#d5cdbd";
  if (kind === "lantern") return <LanternProp position={[0, 0, 0]} scale={0.65} reducedMotion={reducedMotion} />;
  if (kind === "key") return <KeyProp scale={0.7} />;
  if (kind === "door") return <TactileDoor open={state === "open"} reducedMotion={reducedMotion} />;
  if (kind === "rose") return <MemoryRose burnt={burnt} />;
  if (kind === "feather") return <MemoryFeather burnt={burnt} />;
  if (kind === "origami") return <FoldedPaperBird burnt={burnt} />;
  if (kind === "fabric") return <StoryLinen burnt={burnt} />;
  if (kind === "book") return <ClothboundBook open={state === "open"} burnt={burnt} />;
  if (kind === "letter" || kind === "page") return <StoryPaper letter={kind === "letter"} burnt={burnt} />;
  if (kind === "chair") return <DomesticChair />;
  if (kind === "birds" || kind === "swan") return <group>
    <mesh scale={[.35, .12, .22]}><octahedronGeometry args={[1, 0]} /><meshStandardMaterial color={kind === "birds" ? "#15191b" : cream} roughness={.91} /></mesh>
    <Beam from={[.16, 0, 0]} to={[.25, .35, 0]} radius={.045} color={cream} />
  </group>;
  if (kind === "mirror" || kind === "frame") return <group>
    <mesh position={[0, .72, 0]}><boxGeometry args={[1.1, 1.5, .13]} /><TactileMaterial surface="wood" color="#66503d" roughness={.82} /></mesh>
    <mesh position={[0, .72, -.08]}><planeGeometry args={[.85, 1.24]} /><meshStandardMaterial color={kind === "mirror" ? "#77949d" : "#2b2926"} metalness={kind === "mirror" ? .8 : 0} roughness={kind === "mirror" ? .15 : .9} side={2} /></mesh>
    {[-.44, .44].map(x => <mesh key={x} position={[x, .72, -.084]}><boxGeometry args={[.012, 1.27, .008]} /><meshStandardMaterial color="#a08b65" metalness={.55} roughness={.65} /></mesh>)}
    {[.085, 1.355].map(y => <mesh key={y} position={[0, y, -.084]}><boxGeometry args={[.892, .012, .008]} /><meshStandardMaterial color="#a08b65" metalness={.55} roughness={.65} /></mesh>)}
    {kind === "mirror" && (state === "recognised" || state === "integrated") ? <SovereignMirrorImage /> : null}
  </group>;
  if (kind === "water" || kind === "fire") return <group>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.95, 32]} /><meshStandardMaterial color={kind === "water" ? "#294653" : "#46332b"} metalness={kind === "water" ? .55 : .1} roughness={.2} /></mesh>
    {kind === "fire" ? <mesh position={[0, .42, 0]} scale={[.4, .9, .4]}><octahedronGeometry args={[.7, 1]} /><meshStandardMaterial color="#c87d45" emissive="#ad5027" emissiveIntensity={1.1} transparent opacity={.65} /></mesh> : null}
  </group>;
  if (kind === "candle") return <group>
    <mesh position={[0, .2, 0]}><cylinderGeometry args={[.07, .085, .4, 12]} /><meshStandardMaterial color={cream} /></mesh>
    {state === "lit" || state === "awakened" ? <mesh position={[0, .45, 0]} scale={[.7, 1.6, .7]}><sphereGeometry args={[.05, 8, 6]} /><meshBasicMaterial color="#ffe0a1" /></mesh> : null}
  </group>;
  if (kind === "basket" || kind === "nest") return <group>
    <mesh><torusGeometry args={[.38, .11, 7, 24]} /><meshStandardMaterial color="#7c6550" roughness={1} /></mesh>
    <mesh rotation={[-Math.PI / 2, 0, 0]}><circleGeometry args={[.38, 18]} /><meshStandardMaterial color="#cab69b" roughness={1} side={2} /></mesh>
  </group>;
  if (kind === "seed") return <group>
    <mesh scale={[.6, 1, .6]}><sphereGeometry args={[.14, 10, 7]} /><meshStandardMaterial color="#826243" roughness={1} /></mesh>
    {state === "planted" || state === "grown" ? <><Beam from={[0, 0, 0]} to={[0, .65, 0]} radius={.018} color="#53684c" /><mesh position={[.1, .55, 0]} scale={[.2, .07, .12]}><sphereGeometry args={[1, 8, 6]} /><meshStandardMaterial color="#768368" /></mesh></> : null}
  </group>;
  if (kind === "path") return <mesh rotation={[-Math.PI / 2, 0, 0]}><planeGeometry args={[1.1, 2.8]} /><meshStandardMaterial color="#777263" transparent opacity={.26} roughness={1} /></mesh>;
  return <mesh scale={[.3, .45, .18]}><dodecahedronGeometry args={[1, 0]} /><meshStandardMaterial color={cream} roughness={.95} /></mesh>;
});
