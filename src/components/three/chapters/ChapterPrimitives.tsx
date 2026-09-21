import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import { useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { stonePathLayout, veilFoldDepth } from "./surfaceGeometry";
import { TactileMaterial, useTactileDetail, type StorySurface } from "../storyEvents/TactileMaterial";
import type { NarrativeChapterId } from "../../../data/journeyWorldLayout.ts";
import type { RenderQualityProfile } from "../renderQuality";

export type Vec3 = [number, number, number];

const CHAPTER_MOON_ALBEDO_PATH = "/textures/environment/moon-albedo-v1.png";

export type ChapterPalette = {
  ground: string;
  deep: string;
  mid: string;
  light: string;
  accent: string;
};

export const CHAPTER_PALETTES: Record<NarrativeChapterId, ChapterPalette> = {
  "broken-floor": {
    ground: "#181715",
    deep: "#05080b",
    mid: "#33434c",
    light: "#b9d4df",
    accent: "#c99354",
  },
  "enchanted-wood": {
    ground: "#202118",
    deep: "#080b08",
    mid: "#44553b",
    light: "#e4d9b0",
    accent: "#c28a4d",
  },
  "blue-moon-sanctuary": {
    ground: "#19212a",
    deep: "#07111c",
    mid: "#607c93",
    light: "#dce8f0",
    accent: "#c895a1",
  },
  nest: {
    ground: "#463729",
    deep: "#171410",
    mid: "#8d7658",
    light: "#f2d7a0",
    accent: "#c99774",
  },
  "sunset-seer": {
    ground: "#1c1a19",
    deep: "#080a10",
    mid: "#67433d",
    light: "#f0a36c",
    accent: "#b9cadd",
  },
  "thorned-house": {
    ground: "#2a211b",
    deep: "#0d0a09",
    mid: "#624838",
    light: "#d6ae78",
    accent: "#804951",
  },
  "wolf-swan-seer": {
    ground: "#26231d",
    deep: "#080b0d",
    mid: "#5f625d",
    light: "#d7d6ca",
    accent: "#bf7447",
  },
  "fire-river": {
    ground: "#201d1b",
    deep: "#080b10",
    mid: "#4f5e68",
    light: "#dbe4e5",
    accent: "#c55c2e",
  },
  fork: {
    ground: "#242219",
    deep: "#080a08",
    mid: "#53523f",
    light: "#ded4b5",
    accent: "#b8783e",
  },
  "three-climbs": {
    ground: "#353634",
    deep: "#0c1015",
    mid: "#737a7a",
    light: "#dedbd0",
    accent: "#c6a66e",
  },
  "crowned-return": {
    ground: "#75694a",
    deep: "#15181b",
    mid: "#938d72",
    light: "#f3dfac",
    accent: "#bd8258",
  },
  "lantern-epilogue": {
    ground: "#17191a",
    deep: "#02060c",
    mid: "#516473",
    light: "#e7edf0",
    accent: "#d49b57",
  },
};

export function qualityStep(profile: RenderQualityProfile) {
  if (profile.quality === "cinematic") return 3;
  if (profile.quality === "high") return 2;
  if (profile.quality === "medium") return 1;
  return 0;
}

export const SceneGround = memo(function SceneGround({
  radius = 14,
  color,
  y = -0.16,
  roughness = 0.96,
  metalness = 0,
}: {
  radius?: number;
  color: string;
  y?: number;
  roughness?: number;
  metalness?: number;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      <TactileMaterial surface="earth" color={color} roughness={roughness} metalness={metalness} />
    </mesh>
  );
});

export const WaterSurface = memo(function WaterSurface({
  position = [0, 0.02, 0],
  size = [12, 10],
  color = "#182b39",
  opacity = 0.82,
  circle = false,
}: {
  position?: Vec3;
  size?: [number, number];
  color?: string;
  opacity?: number;
  circle?: boolean;
}) {
  return (
    <mesh position={position} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      {circle ? <circleGeometry args={[size[0] * 0.5, 48]} /> : <planeGeometry args={size} />}
      <meshPhysicalMaterial
        color={color}
        roughness={0.14}
        metalness={0.34}
        clearcoat={0.7}
        clearcoatRoughness={0.16}
        transparent
        opacity={opacity}
        depthWrite={opacity >= 0.95}
      />
    </mesh>
  );
});

export const MoonDisc = memo(function MoonDisc({
  position = [0, 9, -12],
  radius = 3.4,
  color = "#dce9f1",
  intensity = 1.7,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
}: {
  position?: Vec3;
  radius?: number;
  color?: string;
  intensity?: number;
  qualityProfile?: RenderQualityProfile;
  reducedEffects?: boolean;
  reducedMotion?: boolean;
}) {
  const texture = useTexture(CHAPTER_MOON_ALBEDO_PATH);
  const groupRef = useRef<THREE.Group>(null);
  const haloMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const cameraQuaternionRef = useRef(new THREE.Quaternion());
  const parentQuaternionRef = useRef(new THREE.Quaternion());
  const localQuaternionRef = useRef(new THREE.Quaternion());
  const quality = qualityProfile?.quality ?? "medium";
  const qualityIndex = quality === "cinematic" ? 3 : quality === "high" ? 2 : quality === "medium" ? 1 : 0;
  // The old primitive interpreted the authored radius literally on a nearby
  // sphere, allowing it to occupy (and clip against) most of the viewport.
  // Keep the authored value expressive, but cap its apparent chapter-scale
  // diameter so this moon remains a distant landmark.
  const displayRadius = THREE.MathUtils.clamp(0.54 + radius * 0.19, 0.72, 1.36);
  const haloRadius = displayRadius * (reducedEffects ? 1.9 : qualityIndex >= 2 ? 2.5 : 2.25);
  const discSegments = qualityIndex === 0 ? 24 : qualityIndex === 1 ? 32 : 48;
  const haloSegments = qualityIndex === 0 ? 20 : qualityIndex === 1 ? 28 : 40;
  const baseHaloOpacity = (reducedEffects ? 0.014 : [0.024, 0.034, 0.044, 0.05][qualityIndex])
    * THREE.MathUtils.clamp(intensity / 1.7, 0.72, 1.08);
  const moonTint = useMemo(() => new THREE.Color(color), [color]);
  const discUniforms = useMemo(
    () => ({
      moonMap: { value: texture },
      moonTint: { value: moonTint },
      moonStrength: { value: THREE.MathUtils.clamp(0.72 + intensity * 0.15, 0.82, 1.05) },
    }),
    [intensity, moonTint, texture],
  );
  const haloUniforms = useMemo(
    () => ({
      haloColor: { value: moonTint },
      haloOpacity: { value: baseHaloOpacity },
    }),
    [baseHaloOpacity, moonTint],
  );

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.anisotropy = qualityIndex >= 2 ? 4 : 2;
    texture.needsUpdate = true;
  }, [qualityIndex, texture]);

  useFrame(({ camera, clock }) => {
    const group = groupRef.current;
    if (!group) return;

    camera.getWorldQuaternion(cameraQuaternionRef.current);
    if (group.parent) {
      group.parent.getWorldQuaternion(parentQuaternionRef.current);
    } else {
      parentQuaternionRef.current.identity();
    }
    localQuaternionRef.current
      .copy(parentQuaternionRef.current)
      .invert()
      .multiply(cameraQuaternionRef.current);
    group.quaternion.copy(localQuaternionRef.current);

    if (haloMaterialRef.current) {
      const breath = reducedMotion || reducedEffects
        ? 1
        : 1 + Math.sin(clock.elapsedTime * 0.22) * (qualityIndex >= 2 ? 0.055 : 0.035);
      haloMaterialRef.current.uniforms.haloOpacity.value = baseHaloOpacity * breath;
    }
  });

  return (
    <group
      ref={groupRef}
      position={position}
      name="textured-chapter-moon"
      userData={{ requestedRadius: radius, displayRadius }}
    >
      <mesh position={[0, 0, -0.02]} renderOrder={-8}>
        <circleGeometry args={[haloRadius, haloSegments]} />
        <shaderMaterial
          ref={haloMaterialRef}
          uniforms={haloUniforms}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vHaloUv;
            void main() {
              vHaloUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform vec3 haloColor;
            uniform float haloOpacity;
            varying vec2 vHaloUv;
            void main() {
              float radius = length((vHaloUv - 0.5) * 2.0);
              if (radius > 1.0) discard;
              float corona = pow(max(0.0, 1.0 - radius), 3.35);
              float innerVeil = (1.0 - smoothstep(0.08, 0.42, radius)) * 0.16;
              gl_FragColor = vec4(haloColor, (corona + innerVeil) * haloOpacity);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
      <mesh renderOrder={-7}>
        <circleGeometry args={[displayRadius, discSegments]} />
        <shaderMaterial
          uniforms={discUniforms}
          transparent
          alphaTest={0.018}
          depthWrite={false}
          toneMapped={false}
          vertexShader={`
            varying vec2 vMoonUv;
            void main() {
              vMoonUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D moonMap;
            uniform vec3 moonTint;
            uniform float moonStrength;
            varying vec2 vMoonUv;
            void main() {
              vec2 point = (vMoonUv - 0.5) * 2.0;
              float radialDistance = length(point);
              if (radialDistance > 1.0) discard;

              vec4 albedo = texture2D(moonMap, vMoonUv);
              float sphereDepth = sqrt(max(0.0, 1.0 - dot(point, point)));
              vec3 sphereNormal = normalize(vec3(point, sphereDepth));
              float illumination = 0.52 + 0.48 * max(0.0, dot(sphereNormal, normalize(vec3(-0.3, 0.2, 0.93))));
              float limb = (1.0 - smoothstep(0.77, 1.0, radialDistance)) * smoothstep(0.0, 0.08, sphereDepth);
              float luminance = dot(albedo.rgb, vec3(0.2126, 0.7152, 0.0722));
              vec3 craterDetail = mix(vec3(luminance), albedo.rgb, 0.74);
              vec3 restrainedTint = mix(vec3(1.0), moonTint, 0.34);
              vec3 moonColor = craterDetail * restrainedTint * illumination * moonStrength;
              gl_FragColor = vec4(moonColor, albedo.a * limb);
              #include <colorspace_fragment>
            }
          `}
        />
      </mesh>
    </group>
  );
});

export const Beam = memo(function Beam({
  from,
  to,
  radius = 0.06,
  color,
  opacity = 1,
  radialSegments = 7,
  surface,
}: {
  from: Vec3;
  to: Vec3;
  radius?: number;
  color: string;
  opacity?: number;
  radialSegments?: number;
  surface?: StorySurface;
}) {
  const transform = useMemo(() => {
    const start = new THREE.Vector3(...from);
    const end = new THREE.Vector3(...to);
    const direction = end.clone().sub(start);
    const length = Math.max(0.001, direction.length());
    const quaternion = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      direction.normalize(),
    );
    return {
      position: start.add(end).multiplyScalar(0.5),
      quaternion,
      length,
    };
  }, [from, to]);

  return (
    <mesh position={transform.position} quaternion={transform.quaternion}>
      <cylinderGeometry args={[radius, radius, transform.length, radialSegments]} />
      {surface ? <TactileMaterial surface={surface} color={color} roughness={0.84} transparent={opacity < 1} opacity={opacity} /> : <meshStandardMaterial color={color} roughness={0.84} transparent={opacity < 1} opacity={opacity} />}
    </mesh>
  );
});

const TREE_PATTERN = Array.from({ length: 28 }, (_, index): Vec3 => {
  const side = index % 2 === 0 ? -1 : 1;
  const row = Math.floor(index / 2);
  const spread = 6.4 + (row % 4) * 1.75;
  return [side * spread, -0.05, -11 + row * 1.75];
});

export const TreeGrove = memo(function TreeGrove({
  qualityProfile,
  reducedEffects,
  tint = "#263123",
  trunk = "#30251c",
  radius = 15,
}: {
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  tint?: string;
  trunk?: string;
  radius?: number;
}) {
  const detail = qualityStep(qualityProfile);
  const count = reducedEffects ? 8 : 12 + detail * 4;
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    for (let index = 0; index < count; index += 1) {
      const source = TREE_PATTERN[index];
      const scale = 0.82 + (index % 5) * 0.08;
      dummy.position.set(source[0] * (radius / 15), 2.5 * scale, source[2] * (radius / 15));
      dummy.scale.set(0.62 * scale, 5 * scale, 0.62 * scale);
      dummy.rotation.y = (index * 1.77) % Math.PI;
      dummy.updateMatrix();
      trunkRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.y = 6.7 * scale;
      dummy.scale.set(2.25 * scale, 3.7 * scale, 2.25 * scale);
      dummy.updateMatrix();
      crownRef.current?.setMatrixAt(index, dummy.matrix);
    }
    if (trunkRef.current) { trunkRef.current.instanceMatrix.needsUpdate = true; trunkRef.current.computeBoundingSphere(); }
    if (crownRef.current) { crownRef.current.instanceMatrix.needsUpdate = true; crownRef.current.computeBoundingSphere(); }
  }, [count, radius]);

  return (
    <group>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, count]} castShadow receiveShadow>
        <cylinderGeometry args={[0.3, 0.46, 1, 7]} />
        <TactileMaterial surface="bark" color={trunk} roughness={1} />
      </instancedMesh>
      <instancedMesh ref={crownRef} args={[undefined, undefined, count]} receiveShadow>
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color={tint} roughness={0.98} />
      </instancedMesh>
    </group>
  );
});

export const CandleField = memo(function CandleField({
  qualityProfile,
  reducedEffects,
  count = 18,
  radius = 6,
  color = "#ffcf8a",
  y = 0,
}: {
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  count?: number;
  radius?: number;
  color?: string;
  y?: number;
}) {
  const visibleCount = reducedEffects
    ? Math.min(5, count)
    : Math.min(count, 8 + qualityStep(qualityProfile) * 5);
  const waxRef = useRef<THREE.InstancedMesh>(null);
  const flameRef = useRef<THREE.InstancedMesh>(null);

  useLayoutEffect(() => {
    const dummy = new THREE.Object3D();
    for (let index = 0; index < visibleCount; index += 1) {
      const angle = (index / visibleCount) * Math.PI * 2 + (index % 3) * 0.17;
      const ring = radius * (0.66 + (index % 4) * 0.085);
      const height = 0.34 + (index % 3) * 0.09;
      dummy.position.set(Math.cos(angle) * ring, y + height * 0.5, Math.sin(angle) * ring);
      dummy.scale.set(1, height, 1);
      dummy.rotation.set(0, angle, 0);
      dummy.updateMatrix();
      waxRef.current?.setMatrixAt(index, dummy.matrix);

      dummy.position.y = y + height + 0.13;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      flameRef.current?.setMatrixAt(index, dummy.matrix);
    }
    if (waxRef.current) waxRef.current.instanceMatrix.needsUpdate = true;
    if (flameRef.current) flameRef.current.instanceMatrix.needsUpdate = true;
  }, [radius, visibleCount, y]);

  return (
    <group>
      <instancedMesh ref={waxRef} args={[undefined, undefined, visibleCount]}>
        <cylinderGeometry args={[0.055, 0.065, 1, 8]} />
        <TactileMaterial surface="wax" color="#e5dbc8" roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={flameRef} args={[undefined, undefined, visibleCount]}>
        <sphereGeometry args={[0.075, 8, 6]} />
        <meshBasicMaterial color={color} toneMapped={false} />
      </instancedMesh>
    </group>
  );
});

export const FlickerLight = memo(function FlickerLight({
  position,
  color = "#ffc071",
  intensity = 2.2,
  distance = 15,
  reducedMotion,
}: {
  position: Vec3;
  color?: string;
  intensity?: number;
  distance?: number;
  reducedMotion: boolean;
}) {
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.intensity = reducedMotion
      ? intensity
      : intensity * (0.94 + Math.sin(clock.elapsedTime * 5.7) * 0.035 + Math.sin(clock.elapsedTime * 13.1) * 0.018);
  });
  return <pointLight ref={light} position={position} color={color} intensity={intensity} distance={distance} decay={2} />;
});

export const FabricVeil = memo(function FabricVeil({
  position,
  rotation = [0, 0, 0],
  size = [2.1, 4.6],
  color = "#dedbd0",
  opacity = 0.72,
  reducedMotion,
  phase = 0,
}: {
  position: Vec3;
  rotation?: Vec3;
  size?: [number, number];
  color?: string;
  opacity?: number;
  reducedMotion: boolean;
  phase?: number;
}) {
  const group = useRef<THREE.Group>(null);
  const detail = useTactileDetail();
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(size[0], size[1], detail === "relief" ? 20 : 12, detail === "relief" ? 10 : 4);
    const position = plane.attributes.position, uv = plane.attributes.uv;
    for (let i = 0; i < position.count; i++) position.setZ(i, veilFoldDepth(uv.getX(i), uv.getY(i), size[0]));
    position.needsUpdate = true;
    plane.computeVertexNormals(); plane.computeBoundingBox(); plane.computeBoundingSphere();
    return plane;
  }, [size[0], size[1], detail]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  useFrame(({ clock }) => {
    if (!group.current) return;
    if (reducedMotion) { group.current.rotation.set(...rotation); return; }
    group.current.rotation.z = rotation[2] + Math.sin(clock.elapsedTime * 0.48 + phase) * 0.025;
    group.current.rotation.y = rotation[1] + Math.sin(clock.elapsedTime * 0.31 + phase * 0.7) * 0.035;
  });
  return (
    <group ref={group} position={position} rotation={rotation}>
      <mesh geometry={geometry}>
        <TactileMaterial surface="linen"
          color={color}
          roughness={0.94}
          side={THREE.DoubleSide}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
});

export const FloatingMotes = memo(function FloatingMotes({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  color = "#d6b66f",
  radius = 8,
  height = 5,
}: {
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  color?: string;
  radius?: number;
  height?: number;
}) {
  const points = useRef<THREE.Points>(null);
  const count = reducedEffects ? 0 : 18 + qualityStep(qualityProfile) * 18;
  const positions = useMemo(() => {
    const result = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const angle = index * 2.399963;
      const distance = radius * (0.18 + ((index * 37) % 100) / 122);
      result[index * 3] = Math.cos(angle) * distance;
      result[index * 3 + 1] = 0.5 + ((index * 53) % 100) / 100 * height;
      result[index * 3 + 2] = Math.sin(angle) * distance;
    }
    return result;
  }, [count, height, radius]);

  useFrame((_, delta) => {
    if (!points.current || reducedMotion) return;
    points.current.rotation.y += Math.min(delta, 0.05) * 0.018;
  });

  if (count === 0) return null;
  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.075} transparent opacity={0.72} depthWrite={false} sizeAttenuation />
    </points>
  );
});

export const LanternProp = memo(function LanternProp({
  position = [0, 1, 0],
  scale = 1,
  color = "#ffc778",
  reducedMotion,
  light = true,
}: {
  position?: Vec3;
  scale?: number;
  color?: string;
  reducedMotion: boolean;
  light?: boolean;
}) {
  return (
    <group position={position} scale={scale}>
      {[0.08, 0.84].map((y) => <mesh key={y} position={[0, y, 0]}>
        <cylinderGeometry args={[0.3, 0.33, 0.12, 8]} />
        <meshStandardMaterial color="#29231b" metalness={0.65} roughness={0.34} />
      </mesh>)}
      {[-1, 1].flatMap(x => [-1, 1].map(z => <Beam key={`${x}:${z}`} from={[x * .18, .12, z * .18]} to={[x * .18, .83, z * .18]} radius={.022} color="#332a20" />))}
      <mesh position={[0, 0.46, 0]}>
        <cylinderGeometry args={[0.22, 0.22, 0.62, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.72} toneMapped={false} />
      </mesh>
      <Beam from={[-0.22, 0.88, 0]} to={[0, 1.18, 0]} radius={0.025} color="#1c1914" />
      <Beam from={[0.22, 0.88, 0]} to={[0, 1.18, 0]} radius={0.025} color="#1c1914" />
      {light ? (
        <FlickerLight position={[0, 0.64, 0]} color={color} intensity={1.8} distance={9} reducedMotion={reducedMotion} />
      ) : null}
    </group>
  );
});

export const DoorFrame = memo(function DoorFrame({
  position = [0, 0, 0],
  width = 3,
  height = 4.8,
  depth = 0.5,
  color = "#3e3025",
  open = true,
}: {
  position?: Vec3;
  width?: number;
  height?: number;
  depth?: number;
  color?: string;
  open?: boolean;
}) {
  return (
    <group position={position}>
      <mesh position={[-width * 0.5, height * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, height, depth]} />
        <TactileMaterial surface="wood" color={color} roughness={0.9} />
      </mesh>
      <mesh position={[width * 0.5, height * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.42, height, depth]} />
        <TactileMaterial surface="wood" color={color} roughness={0.9} />
      </mesh>
      <mesh position={[0, height, 0]} castShadow receiveShadow>
        <boxGeometry args={[width + 0.42, 0.45, depth]} />
        <TactileMaterial surface="wood" color={color} roughness={0.9} />
      </mesh>
      {open ? null : (
        <mesh position={[0, height * 0.48, 0.04]}>
          <boxGeometry args={[width - 0.32, height - 0.5, 0.2]} />
          <TactileMaterial surface="wood" color="#30251f" roughness={0.92} />
        </mesh>
      )}
    </group>
  );
});

export const ReflectivePanel = memo(function ReflectivePanel({
  position = [0, 2.6, 0],
  rotation = [0, 0, 0],
  size = [4, 5],
  cracked = false,
  warm = false,
}: {
  position?: Vec3;
  rotation?: Vec3;
  size?: [number, number];
  cracked?: boolean;
  warm?: boolean;
}) {
  const glass = warm ? "#6d5146" : "#6e8492";
  return (
    <group position={position} rotation={rotation}>
      <mesh>
        <boxGeometry args={[size[0] + 0.34, size[1] + 0.34, 0.18]} />
        <meshStandardMaterial color="#25201c" metalness={0.64} roughness={0.38} />
      </mesh>
      <mesh position={[0, 0, 0.12]}>
        <planeGeometry args={size} />
        <meshPhysicalMaterial color={glass} metalness={0.64} roughness={0.09} clearcoat={0.8} />
      </mesh>
      {cracked ? (
        <group position={[0, 0, 0.17]}>
          <Beam from={[-0.15, 2.1, 0]} to={[0.12, 0.2, 0]} radius={0.018} color="#d4c9b4" />
          <Beam from={[0.12, 0.2, 0]} to={[-1.25, -1.1, 0]} radius={0.018} color="#d4c9b4" />
          <Beam from={[0.12, 0.2, 0]} to={[1.4, -0.45, 0]} radius={0.018} color="#d4c9b4" />
          <Beam from={[0.12, 0.2, 0]} to={[0.64, -2.05, 0]} radius={0.018} color="#d4c9b4" />
        </group>
      ) : null}
    </group>
  );
});

export const HouseShell = memo(function HouseShell({
  position = [0, 0, 0],
  size = [8, 4.8, 6],
  wallColor = "#5a4938",
  roofColor = "#28231e",
  openFront = true,
}: {
  position?: Vec3;
  size?: Vec3;
  wallColor?: string;
  roofColor?: string;
  openFront?: boolean;
}) {
  const [width, height, depth] = size;
  return (
    <group position={position}>
      <mesh position={[0, height, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
        <boxGeometry args={[width * 0.74, width * 0.74, depth + 0.7]} />
        <TactileMaterial surface="wood" color={roofColor} roughness={0.96} />
      </mesh>
      <mesh position={[-width * 0.5, height * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.35, height, depth]} />
        <TactileMaterial surface="wood" color={wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[width * 0.5, height * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.35, height, depth]} />
        <TactileMaterial surface="wood" color={wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[0, height * 0.5, depth * 0.5]} castShadow receiveShadow>
        <boxGeometry args={[width, height, 0.35]} />
        <TactileMaterial surface="wood" color={wallColor} roughness={0.95} />
      </mesh>
      {openFront ? null : (
        <mesh position={[0, height * 0.5, -depth * 0.5]}>
          <boxGeometry args={[width, height, 0.3]} />
          <TactileMaterial surface="wood" color={wallColor} roughness={0.95} />
        </mesh>
      )}
    </group>
  );
});

export const KeyProp = memo(function KeyProp({
  position = [0, 1.1, 0],
  color = "#b99252",
  scale = 1,
}: {
  position?: Vec3;
  color?: string;
  scale?: number;
}) {
  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0.18]} scale={scale}>
      <mesh>
        <torusGeometry args={[0.34, 0.07, 8, 20]} />
        <TactileMaterial surface="metal" color={color} metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[0.68, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.065, 0.065, 0.92, 8]} />
        <TactileMaterial surface="metal" color={color} metalness={0.72} roughness={0.28} />
      </mesh>
      <mesh position={[1.04, -0.16, 0]}>
        <boxGeometry args={[0.12, 0.36, 0.12]} />
        <TactileMaterial surface="metal" color={color} metalness={0.72} roughness={0.28} />
      </mesh>
    </group>
  );
});

export const StonePath = memo(function StonePath({
  color = "#625e54", count = 9, length = 12, fork = 0, y = 0,
}: { color?: string; count?: number; length?: number; fork?: number; y?: number }) {
  const forms = useMemo(() => stonePathLayout(count, length, fork, y), [count, length, fork, y]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  useLayoutEffect(() => {
    const target = mesh.current;
    if (!target) return;
    const dummy = new THREE.Object3D();
    for (const [index, form] of forms.entries()) {
      dummy.position.set(...form.position); dummy.rotation.set(...form.rotation); dummy.scale.set(...form.scale);
      dummy.updateMatrix(); target.setMatrixAt(index, dummy.matrix);
    }
    target.instanceMatrix.needsUpdate = true;
    target.computeBoundingSphere(); target.computeBoundingBox();
  }, [forms]);
  if (forms.length === 0) return null;
  return <instancedMesh ref={mesh} name="shared-stone-path" args={[undefined, undefined, forms.length]} receiveShadow>
    <circleGeometry args={[1, 8]} />
    <TactileMaterial surface="stone" color={color} roughness={0.98} />
  </instancedMesh>;
});

export const ThornBranches = memo(function ThornBranches({
  color = "#34251f",
  density = 1,
}: {
  color?: string;
  density?: number;
}) {
  const branches = [
    { from: [-7, 0, -4] as Vec3, to: [-2, 5, -1] as Vec3 },
    { from: [7, 0, -3] as Vec3, to: [2, 5.5, 0] as Vec3 },
    { from: [-5, 4, 2] as Vec3, to: [1, 1.2, 3] as Vec3 },
    { from: [6, 3.5, 3] as Vec3, to: [0, 1, 1] as Vec3 },
    { from: [-4, 0.4, 5] as Vec3, to: [3, 4.2, 4] as Vec3 },
    { from: [5, 0.3, -5] as Vec3, to: [-1, 3.7, -3] as Vec3 },
  ].slice(0, Math.max(2, Math.round(6 * density)));
  return (
    <group>
      {branches.map((branch, index) => (
        <Beam surface="bark" key={index} from={branch.from} to={branch.to} radius={0.08 + (index % 2) * 0.035} color={color} />
      ))}
    </group>
  );
});

export const BirdSwarm = memo(function BirdSwarm({
  count = 18,
  color = "#111315",
  dispersed = false,
}: {
  count?: number;
  color?: string;
  dispersed?: boolean;
}) {
  return (
    <group position={[0, 5.4, -2]}>
      {Array.from({ length: count }, (_, index) => {
        const angle = index * 2.27;
        const radius = dispersed ? 2.4 + index * 0.27 : 0.8 + (index % 5) * 0.22;
        const position: Vec3 = [
          Math.cos(angle) * radius,
          Math.sin(index * 1.7) * 1.1 + index * 0.07,
          Math.sin(angle) * radius * 0.55,
        ];
        return (
          <group key={index} position={position} rotation={[0, -angle, Math.sin(index) * 0.22]} scale={0.42}>
            <mesh position={[-0.3, 0, 0]} rotation={[0, 0, -0.35]}>
              <coneGeometry args={[0.16, 0.72, 3]} />
              <meshBasicMaterial color={color} />
            </mesh>
            <mesh position={[0.3, 0, 0]} rotation={[0, 0, 0.35]}>
              <coneGeometry args={[0.16, 0.72, 3]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
});

export const ConstellationField = memo(function ConstellationField({
  color = "#e5ebec",
  accent = "#d49b57",
}: {
  color?: string;
  accent?: string;
}) {
  const stars: Vec3[] = [
    [-5, 5, -4], [-3.4, 6.3, -4.2], [-1.5, 5.7, -4.1], [0.4, 7.1, -4.5],
    [2.2, 6.4, -4.3], [4.3, 7.6, -4.6], [5.8, 6.1, -4.2], [1.2, 4.9, -4],
  ];
  return (
    <group>
      {stars.map((star, index) => (
        <mesh key={index} position={star}>
          <sphereGeometry args={[index === 3 ? 0.12 : 0.075, 10, 8]} />
          <meshBasicMaterial color={index === 3 ? accent : color} toneMapped={false} />
        </mesh>
      ))}
      {stars.slice(0, -1).map((star, index) => (
        <Beam key={index} from={star} to={stars[index + 1]} radius={0.012} color={color} opacity={0.58} radialSegments={5} />
      ))}
    </group>
  );
});
