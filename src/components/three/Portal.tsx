import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Html, PerspectiveCamera, RenderTexture, Text, useCursor, useTexture } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import type { PortalLocation, Slipper3DEntry, Slipper3DVisual } from "../../data/slipper3dTypes";
import type { NarrativeWorldState } from "./StoryScene";
import { resolveChapterDirector } from "./chapterDirector";

type PortalProps = {
  portal: PortalLocation;
  targetEntry?: Slipper3DEntry;
  targetVisual?: Slipper3DVisual;
  narrativeWorldState?: NarrativeWorldState;
  isVisited?: boolean;
  isTriggering?: boolean;
  shortcut?: number;
  onSelect: (targetEntryId: string) => void;
};

const RITUAL_UNLOCK_MS = 2000;

const DEFAULT_STATE: NarrativeWorldState = {
  visitedCount: 1,
  totalCount: 1,
  traceCount: 1,
  fireCount: 0,
  waterCount: 0,
  memoryCount: 0,
  thresholdCount: 0,
  crownCount: 0,
  fireWaterBalance: 0,
  explorationDepth: 0,
  memoryPressure: 0,
  symbolicWeight: 0.5,
};

function PortalGlyph({ portal, hovered, isVisited, isTriggering }: { portal: PortalLocation; hovered: boolean; isVisited: boolean; isTriggering: boolean }) {
  const color = portal.color ?? "#d8d0ba";
  const strength = Math.max(1, Math.min(5, portal.strength ?? 3));
  const opacity = isVisited ? 0.42 : 0.72 + strength * 0.045;
  const scale = isTriggering ? 1.28 : hovered ? 1.1 : 1;

  if (portal.kind === "chapter") {
    return (
      <group scale={scale}>
        <mesh position={[-0.42, 0, 0]}>
          <boxGeometry args={[0.035, 0.86, 0.035]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0.42, 0, 0]}>
          <boxGeometry args={[0.035, 0.86, 0.035]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
        <mesh position={[0, 0.43, 0]}>
          <boxGeometry args={[0.86, 0.035, 0.035]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
        <mesh>
          <ringGeometry args={[0.44, 0.48, 84]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.2 : 0.1} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      </group>
    );
  }

  if (portal.kind === "tag") {
    return (
      <group scale={scale}>
        <mesh rotation={[0, 0, Math.PI * 0.25]}>
          <torusGeometry args={[0.42, 0.008 + strength * 0.001, 12, 128]} />
          <meshBasicMaterial color={color} transparent opacity={opacity} />
        </mesh>
        <mesh rotation={[0, 0, -Math.PI * 0.25]}>
          <torusGeometry args={[0.26, 0.005, 12, 96]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={hovered ? 0.34 : 0.18} />
        </mesh>
        <mesh scale={[1.4, 0.06, 1]}>
          <boxGeometry args={[0.48, 0.018, 0.018]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.38 : 0.18} />
        </mesh>
      </group>
    );
  }

  if (portal.kind === "visual") {
    return (
      <group scale={scale} rotation={[0, 0, Math.PI * 0.25]}>
        <mesh>
          <planeGeometry args={[0.62, 0.62]} />
          <meshBasicMaterial color={color} transparent opacity={hovered ? 0.26 : 0.16} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.022]} rotation={[0, 0, Math.PI * 0.25]}>
          <ringGeometry args={[0.22, 0.26, 4]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.28} side={THREE.DoubleSide} />
        </mesh>
      </group>
    );
  }

  return (
    <group scale={scale}>
      <mesh>
        <torusGeometry args={[0.48, 0.018 + strength * 0.002, 20, 128]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI * 0.25]}>
        <torusGeometry args={[0.31, 0.006, 12, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={hovered ? 0.34 : 0.18} />
      </mesh>
      <mesh position={[0, 0, 0.024]}>
        <circleGeometry args={[0.36, 72]} />
        <meshBasicMaterial color={color} transparent opacity={hovered ? 0.2 : 0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.034]}>
        <sphereGeometry args={[0.036 + strength * 0.004, 20, 20]} />
        <meshBasicMaterial color={color} transparent opacity={isVisited ? 0.5 : 1} />
      </mesh>
    </group>
  );
}

function GhostVisualShrine({ visual, color }: { visual: Slipper3DVisual; color: string }) {
  const texture = useTexture(visual.src);
  const isSquare = visual.orientation === "square";
  const width = isSquare ? 0.74 : 0.52;
  const height = isSquare ? 0.74 : 0.88;

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.needsUpdate = true;
  }, [texture]);

  return (
    <group position={[0, 0, -0.035]}>
      <mesh position={[0, 0, -0.018]}>
        <planeGeometry args={[width + 0.18, height + 0.18]} />
        <meshBasicMaterial color="#050506" transparent opacity={0.32} depthWrite={false} />
      </mesh>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} transparent opacity={0.22} toneMapped={false} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, -height * 0.58, 0.012]} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.17, 0.25, 64]} />
        <meshBasicMaterial color={color} transparent opacity={0.14} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
}

function GhostProceduralDome({ targetEntry, narrativeWorldState }: { targetEntry?: Slipper3DEntry; narrativeWorldState: NarrativeWorldState }) {
  const [low = "#050506", mid = "#0d1110", high = "#c8b38a"] = targetEntry?.engine3d.environmentGradient ?? [];
  const uniforms = useMemo(
    () => ({
      colorLow: { value: new THREE.Color(low) },
      colorMid: { value: new THREE.Color(mid) },
      colorHigh: { value: new THREE.Color(high) },
      depth: { value: narrativeWorldState.explorationDepth },
      memory: { value: narrativeWorldState.memoryPressure },
    }),
    [],
  );

  useEffect(() => {
    uniforms.colorLow.value.set(low);
    uniforms.colorMid.value.set(mid);
    uniforms.colorHigh.value.set(high);
  }, [high, low, mid, uniforms]);

  useFrame((_, delta) => {
    const t = 1 - Math.exp(-delta * 1.6);
    uniforms.depth.value = THREE.MathUtils.lerp(uniforms.depth.value, narrativeWorldState.explorationDepth, t);
    uniforms.memory.value = THREE.MathUtils.lerp(uniforms.memory.value, narrativeWorldState.memoryPressure, t);
  });

  return (
    <mesh scale={[-1, 1, 1]} position={[0, 0, -0.055]}>
      <sphereGeometry args={[0.43, 40, 22]} />
      <shaderMaterial
        side={THREE.BackSide}
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormalish;
          void main() {
            vNormalish = normalize(position);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 colorLow;
          uniform vec3 colorMid;
          uniform vec3 colorHigh;
          uniform float depth;
          uniform float memory;
          varying vec3 vNormalish;
          void main() {
            float h = vNormalish.y * 0.5 + 0.5;
            vec3 col = mix(colorLow, colorMid, smoothstep(0.0, 0.75, h));
            col = mix(col, colorHigh, smoothstep(0.62, 1.0, h) * 0.32);
            col *= 1.0 - depth * 0.22;
            col = mix(col, vec3(0.42, 0.32, 0.62), memory * 0.16);
            gl_FragColor = vec4(col, 0.20 + memory * 0.10);
          }
        `}
      />
    </mesh>
  );
}

function PortalLookThrough({
  color,
  targetEntry,
  narrativeWorldState,
  isTriggering,
}: {
  color: string;
  targetEntry?: Slipper3DEntry;
  narrativeWorldState: NarrativeWorldState;
  isTriggering: boolean;
}) {
  const gradient = targetEntry?.engine3d.environmentGradient ?? ["#090807", "#1a1612"];
  const title = targetEntry?.title ?? "Unknown clearing";

  const fire = narrativeWorldState.fireWaterBalance > 0.15;
  const water = narrativeWorldState.fireWaterBalance < -0.15;

  return (
    <mesh position={[0, 0, -0.026]}>
      <circleGeometry args={[0.49, 96]} />
      <meshBasicMaterial transparent opacity={isTriggering ? 0.95 : 0.78} toneMapped={false}>
        <RenderTexture attach="map" width={768} height={768} anisotropy={8}>
          <PerspectiveCamera makeDefault manual aspect={1} position={[0, 1.1, 4.2]} fov={45} />
          <color attach="background" args={[gradient[0]]} />
          <ambientLight intensity={0.8} />
          <pointLight position={[0, 2.5, 2]} intensity={1.8} color={color} />

          <mesh position={[0, -0.7, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[2.2, 96]} />
            <meshBasicMaterial color={gradient[1]} transparent opacity={0.92} />
          </mesh>

          <mesh position={[-0.75, 0.1, -0.25]}>
            <coneGeometry args={[0.35, 1.8, 7]} />
            <meshBasicMaterial color={fire ? "#9d3f1f" : water ? "#4d7f90" : "#1d2a1d"} />
          </mesh>

          <mesh position={[0.8, 0.15, -0.45]}>
            <coneGeometry args={[0.42, 2.1, 7]} />
            <meshBasicMaterial color={fire ? "#6f2b18" : water ? "#335e72" : "#142114"} />
          </mesh>

          <mesh position={[0, 0.4, -0.8]}>
            <sphereGeometry args={[0.22, 24, 24]} />
            <meshBasicMaterial color={color} transparent opacity={0.58} />
          </mesh>

          <Text position={[0, -1.08, 0.2]} fontSize={0.11} maxWidth={2.2} textAlign="center" anchorX="center" anchorY="middle" color="#f5ead2">
            {title}
          </Text>
        </RenderTexture>
      </meshBasicMaterial>
    </mesh>
  );
}

function TemporalEcho({
  targetEntry,
  targetVisual,
  narrativeWorldState = DEFAULT_STATE,
  hovered,
  isTriggering,
}: {
  targetEntry?: Slipper3DEntry;
  targetVisual?: Slipper3DVisual;
  narrativeWorldState?: NarrativeWorldState;
  hovered: boolean;
  isTriggering: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const targetScaleRef = useRef(new THREE.Vector3(1, 1, 1));
  const color = targetEntry?.engine3d.environmentGradient?.[2] ?? "#d8d0ba";

  useFrame(({ clock }, delta) => {
    if (!groupRef.current) return;
    const t = 1 - Math.exp(-delta * 3.5);
    const targetScale = isTriggering ? 1.42 : hovered ? 1.14 : 1;
    targetScaleRef.current.set(targetScale, targetScale, targetScale);
    groupRef.current.scale.lerp(targetScaleRef.current, t);
    groupRef.current.rotation.z = Math.sin(clock.elapsedTime * 0.38) * 0.018;
  });

  return (
    <group ref={groupRef} position={[0, 0.01, -0.045]} scale={0.98}>
      <mesh position={[0, 0, -0.06]}>
        <circleGeometry args={[0.53, 96]} />
        <meshBasicMaterial color={color} transparent opacity={isTriggering ? 0.22 : hovered ? 0.13 : 0.075} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {targetVisual ? <GhostVisualShrine visual={targetVisual} color={color} /> : <GhostProceduralDome targetEntry={targetEntry} narrativeWorldState={narrativeWorldState} />}
      <mesh position={[0, 0, 0.018]}>
        <ringGeometry args={[0.49, 0.515, 96]} />
        <meshBasicMaterial color={color} transparent opacity={isTriggering ? 0.42 : hovered ? 0.24 : 0.13} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

export function Portal({
  portal,
  targetEntry,
  targetVisual,
  narrativeWorldState = DEFAULT_STATE,
  isVisited = false,
  isTriggering = false,
  shortcut,
  onSelect,
}: PortalProps) {
  const [hovered, setHovered] = useState(false);
  const [labelVisible, setLabelVisible] = useState(false);
  const [ritualHolding, setRitualHolding] = useState(false);
  const [ritualProgress, setRitualProgress] = useState(0);
  const labelVisibleRef = useRef(false);
  const ritualStartRef = useRef<number | null>(null);
  const ritualCommittedRef = useRef(false);
  const ritualProgressRef = useRef(0);
  const { camera } = useThree();
  const groupRef = useRef<THREE.Group>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const approachRingRef = useRef<THREE.Mesh>(null);
  const approachMaterialRef = useRef<THREE.MeshBasicMaterial>(null);
  const canNavigate = Boolean(portal.targetEntryId);
  const color = portal.color ?? "#d8d0ba";
  const strength = Math.max(1, Math.min(5, portal.strength ?? 3));
  const director = useMemo(() => (targetEntry ? resolveChapterDirector(targetEntry) : null), [targetEntry]);

  useCursor((hovered || ritualHolding) && canNavigate);

  const materialColor = useMemo(() => new THREE.Color(color), [color]);
  const scaleVectorRef = useRef(new THREE.Vector3(1, 1, 1));

  const cancelRitual = () => {
    if (ritualCommittedRef.current) return;
    ritualStartRef.current = null;
    ritualProgressRef.current = 0;
    setRitualHolding(false);
    setRitualProgress(0);
  };

  const beginRitual = () => {
    if (!portal.targetEntryId || ritualCommittedRef.current) return;
    ritualStartRef.current = performance.now();
    ritualProgressRef.current = 0;
    setRitualHolding(true);
    setRitualProgress(0.01);
  };

  const handleRitualPointerDown = (event?: ThreeEvent<PointerEvent> | ReactPointerEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    beginRitual();
  };

  const handleRitualPointerUp = (event?: ThreeEvent<PointerEvent> | ReactPointerEvent<HTMLButtonElement>) => {
    event?.stopPropagation();
    cancelRitual();
  };

  useEffect(() => {
    const cancel = () => cancelRitual();
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("pointerup", cancel);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", cancel);
    };
  }, []);

  useEffect(() => {
    ritualCommittedRef.current = false;
    ritualStartRef.current = null;
    ritualProgressRef.current = 0;
    setRitualHolding(false);
    setRitualProgress(0);
  }, [portal.id, portal.targetEntryId]);

  useFrame(({ clock }, delta) => {
    const elapsed = clock.getElapsedTime();
    const dx = camera.position.x - portal.position[0];
    const dz = camera.position.z - portal.position[2];
    const distance = Math.sqrt(dx * dx + dz * dz);
    const approachDistance = director ? director.labelRevealDistance * 0.82 : 3.2;
    const approach = THREE.MathUtils.clamp(1 - (distance - 0.92) / Math.max(1.2, approachDistance), 0, 1);
    const shouldShowLabel = hovered || isTriggering || ritualHolding || approach > 0.42;
    if (shouldShowLabel !== labelVisibleRef.current) {
      labelVisibleRef.current = shouldShowLabel;
      setLabelVisible(shouldShowLabel);
    }

    if (groupRef.current) {
      const floatY = portal.position[1] + Math.sin(elapsed * 0.55 + strength) * (0.012 + approach * 0.018);
      groupRef.current.rotation.z = (portal.rotation?.[2] ?? 0) + Math.sin(elapsed * 0.68 + strength) * (0.024 + approach * 0.035);
      groupRef.current.position.y = THREE.MathUtils.lerp(groupRef.current.position.y, floatY, 1 - Math.exp(-delta * 6));
    }

    if (haloRef.current) {
      const pulse = 1 + Math.sin(elapsed * (1.6 + approach * 1.4) + strength) * (0.035 + approach * 0.045);
      const targetScale = isTriggering || ritualHolding ? pulse * 1.82 : hovered ? pulse * 1.15 : pulse * (1 + approach * 0.28);
      scaleVectorRef.current.set(targetScale, targetScale, targetScale);
      haloRef.current.scale.lerp(scaleVectorRef.current, 1 - Math.exp(-delta * 8));
    }

    if (approachRingRef.current) {
      const ringScale = 1.08 + approach * 0.58 + Math.sin(elapsed * 2.1 + strength) * 0.025;
      approachRingRef.current.scale.set(ringScale, ringScale, ringScale);
    }

    if (approachMaterialRef.current) {
      approachMaterialRef.current.opacity = isTriggering || ritualHolding ? 0.34 : 0.035 + approach * 0.2;
    }

    if (ritualStartRef.current !== null && portal.targetEntryId && !ritualCommittedRef.current) {
      const progress = THREE.MathUtils.clamp((performance.now() - ritualStartRef.current) / RITUAL_UNLOCK_MS, 0, 1);
      if (progress >= 1) {
        ritualCommittedRef.current = true;
        ritualStartRef.current = null;
        ritualProgressRef.current = 1;
        setRitualProgress(1);
        setRitualHolding(true);
        onSelect(portal.targetEntryId);
      } else if (Math.abs(progress - ritualProgressRef.current) >= 0.025) {
        ritualProgressRef.current = progress;
        setRitualProgress(progress);
      }
    }
  });

  const baseFarOpacity = director?.portalFarOpacity ?? 0.07;
  const baseNearOpacity = director?.portalNearOpacity ?? 0.38;
  const haloOpacity = isTriggering || ritualHolding ? 0.36 : hovered ? Math.max(0.18, baseNearOpacity * 0.45) : baseFarOpacity + strength * 0.008;

  const handlePointerOver = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(true);
  };

  const handlePointerOut = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    setHovered(false);
  };

  const displayTriggering = isTriggering || ritualHolding;
  const ritualPercent = Math.round(ritualProgress * 100);

  return (
    <group
      ref={groupRef}
      position={portal.position}
      rotation={portal.rotation ?? [0, 0, 0]}
      onClick={(event) => event.stopPropagation()}
      onPointerDown={handleRitualPointerDown}
      onPointerUp={handleRitualPointerUp}
      onPointerOver={handlePointerOver}
      onPointerOut={handlePointerOut}
    >
      <PortalLookThrough color={color} targetEntry={targetEntry} narrativeWorldState={narrativeWorldState} isTriggering={displayTriggering} />
      <TemporalEcho targetEntry={targetEntry} targetVisual={targetVisual} narrativeWorldState={narrativeWorldState} hovered={hovered} isTriggering={displayTriggering} />

      <mesh ref={approachRingRef} position={[0, 0, -0.018]}>
        <ringGeometry args={[0.72, 0.86, 128]} />
        <meshBasicMaterial ref={approachMaterialRef} color={materialColor} transparent opacity={0.035} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <mesh ref={haloRef} scale={hovered ? 1.15 : 1}>
        <ringGeometry args={[0.58, 0.66, 96]} />
        <meshBasicMaterial color={materialColor} transparent opacity={haloOpacity} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>

      <PortalGlyph portal={portal} hovered={hovered} isVisited={isVisited} isTriggering={displayTriggering} />

      {labelVisible ? (
        <Html transform center position={[0, -0.72, 0.02]} distanceFactor={1.25} zIndexRange={[20, 0]}>
          <button
            type="button"
            className={`slipper-portal-label is-${portal.kind}${hovered ? " is-hovered" : ""}${isVisited ? " is-visited" : ""}${displayTriggering ? " is-triggering" : ""}${ritualHolding ? " is-ritual-holding" : ""}`}
            onPointerDown={handleRitualPointerDown}
            onPointerUp={handleRitualPointerUp}
            onClick={(event) => event.stopPropagation()}
            disabled={!canNavigate}
            aria-label={`Hold for two seconds to open the way to ${portal.label}`}
          >
            {shortcut ? <span className="slipper-portal-shortcut">{shortcut}</span> : null}
            <span className="slipper-portal-kind">{portal.kind}</span>
            <span className="slipper-portal-title">{portal.label}</span>
            {targetEntry ? <span className="slipper-portal-description">memory beyond: {targetEntry.title}</span> : portal.description ? <span className="slipper-portal-description">{portal.description}</span> : null}
            <span className="slipper-portal-ritual" aria-hidden="true">
              <i style={{ transform: `scaleX(${ritualProgress})` }} />
            </span>
            <span className="slipper-portal-ritual-text">{ritualHolding ? `opening ${ritualPercent}%` : "hold 2s to open"}</span>
          </button>
        </Html>
      ) : null}
    </group>
  );
}

export default Portal;
