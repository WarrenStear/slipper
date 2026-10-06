import { ChapterGroundMaterial } from "../environment/ChapterGroundMaterial";
import { HeroAssetSlot } from "../actors/HeroAssetSlot";
import { createKeyGeometry, createLanternHousingGeometry, createLanternGlassGeometry, createMirrorFrameGeometry } from "../environmentArt/heroGeometry";
import { useSceneLook } from "../artDirection/SceneLookContext";
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
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { createTaperedBranchGeometry, createWaxCandleGeometry, createFlameGeometry } from "../environmentArt/authoredGeometry";
import { NarrativeWater } from "../environment/SanctuaryWater";
import { createOrganicCrownGeometry } from "../environment/forestGeometry";
import { MirrorMemorySurface } from "../reflections/MirrorMemorySurface";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { TimberAssembly } from "./ChapterArt";
import { createSteppingStoneGeometry, createFlightSilhouetteGeometry, type ConstructionPiece } from "./chapterArtGeometry";
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
  textured = false,
}: {
  radius?: number;
  color: string;
  y?: number;
  roughness?: number;
  metalness?: number;
  textured?: boolean;
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
      <circleGeometry args={[radius, 48]} />
      {textured ? <ChapterGroundMaterial radius={radius} color={color} roughness={roughness} metalness={metalness} />
        : <TactileMaterial surface="earth" color={color} roughness={roughness} metalness={metalness} />}
    </mesh>
  );
});

export const WaterSurface = memo(function WaterSurface({
  position = [0, .02, 0], size = [12, 10], color = "#182b39", opacity = .82, roughness,
  circle = false, flow = 0, reducedMotion, reducedEffects,
}: {
  position?: Vec3; size?: [number, number]; color?: string; opacity?: number; roughness?: number;
  circle?: boolean; flow?: number; reducedMotion?: boolean; reducedEffects?: boolean;
}) {
  const motionPreference = useSettingsStore(state => state.reducedMotion);
  const effectsPreference = useSettingsStore(state => state.reducedEffects);
  return <group position={position}>
    <NarrativeWater width={size[0]} depth={size[1]} color={color} opacity={opacity} roughness={roughness} circle={circle} flow={flow}
      reducedMotion={reducedMotion ?? motionPreference} reducedEffects={reducedEffects ?? effectsPreference} />
  </group>;
});

export const MoonDisc = memo(function MoonDisc({
  position = [0, 9, -12],
  radius = 3.4,
  authoredRadius,
  color = "#dce9f1",
  intensity = 1.7,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
}: {
  position?: Vec3;
  radius?: number;
  /** Explicit hero moons are world-sized; secondary moons keep the comfort cap. */
  authoredRadius?: number;
  color?: string;
  intensity?: number;
  qualityProfile?: RenderQualityProfile;
  reducedEffects?: boolean;
  reducedMotion?: boolean;
}) {
  const presentation = useSceneLook();
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
  const displayRadius = authoredRadius === undefined ? THREE.MathUtils.clamp(0.54 + radius * 0.19, 0.72, 1.36) : THREE.MathUtils.clamp(authoredRadius, .72, 7);
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
        : 1 + Math.sin((presentation?.time.water ?? clock.elapsedTime) * 0.22) * (qualityIndex >= 2 ? 0.055 : 0.035);
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
  const crownGeometry = useMemo(() => createOrganicCrownGeometry(detail >= 2 && !reducedEffects ? 1 : 0), [detail, reducedEffects]);
  useEffect(() => () => crownGeometry.dispose(), [crownGeometry]);

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
      <instancedMesh ref={crownRef} geometry={crownGeometry} args={[undefined, undefined, count]} receiveShadow>
        <meshStandardMaterial color={tint} roughness={0.98} side={THREE.DoubleSide} />
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
  const waxGeometry = useMemo(() => createWaxCandleGeometry(.065, 1, 8), []);
  const flameGeometry = useMemo(() => createFlameGeometry(.065, .19), []);
  useEffect(() => () => { waxGeometry.dispose(); flameGeometry.dispose(); }, [waxGeometry, flameGeometry]);

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
    if (waxRef.current) { waxRef.current.instanceMatrix.needsUpdate = true; waxRef.current.computeBoundingSphere(); waxRef.current.computeBoundingBox(); }
    if (flameRef.current) { flameRef.current.instanceMatrix.needsUpdate = true; flameRef.current.computeBoundingSphere(); flameRef.current.computeBoundingBox(); }
  }, [radius, visibleCount, y]);

  return (
    <group>
      <instancedMesh ref={waxRef} geometry={waxGeometry} args={[undefined, undefined, visibleCount]}>
        <TactileMaterial surface="wax" color="#e5dbc8" roughness={0.82} />
      </instancedMesh>
      <instancedMesh ref={flameRef} geometry={flameGeometry} args={[undefined, undefined, visibleCount]}>
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
  const presentation = useSceneLook();
  const light = useRef<THREE.PointLight>(null);
  useFrame(({ clock }) => {
    if (!light.current) return;
    light.current.intensity = reducedMotion
      ? intensity
      : intensity * (1 + (Math.sin((presentation?.time.flame ?? clock.elapsedTime) * 5.7) * .035 + Math.sin((presentation?.time.flame ?? clock.elapsedTime) * 13.1) * .018) * (presentation ? Math.min(1, presentation.motion.flame * 4) : 1));
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
  const presentation = useSceneLook();
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
    const time = presentation ? presentation.time.cloth * 3 : clock.elapsedTime;
    const amplitude = presentation ? Math.min(1, presentation.motion.cloth * 4) : 1;
    group.current.rotation.z = rotation[2] + Math.sin(time * .48 + phase) * .025 * amplitude;
    group.current.rotation.y = rotation[1] + Math.sin(time * .31 + phase * .7) * .035 * amplitude;
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
  const presentation = useSceneLook();
  const points = useRef<THREE.Points>(null);
  // Canonical airborne matter belongs to WorldEnvironmentParticles/SceneLook.
  const count = presentation || reducedEffects ? 0 : 18 + qualityStep(qualityProfile) * 18;
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
    if (!points.current) return;
    if (!reducedMotion) points.current.rotation.y += Math.min(delta, .05) * .018 * (presentation ? presentation.motion.particles : 1);
    (points.current.material as THREE.PointsMaterial).opacity = presentation ? Math.min(.35, presentation.motion.particles) : .72;
  });

  if (count === 0) return null;
  return (
    <points name="legacy-floating-motes" ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={0.075} transparent opacity={0.72} depthWrite={false} sizeAttenuation
        customProgramCacheKey={() => "sidtw-soft-mote-v1"}
        onBeforeCompile={shader => { shader.fragmentShader = shader.fragmentShader.replace("#include <map_particle_fragment>", `#include <map_particle_fragment>
          float moteRadius = length(gl_PointCoord - .5);
          diffuseColor.a *= 1. - smoothstep(.2, .5, moteRadius);
          if (diffuseColor.a < .01) discard;
        `); }}
      />
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
  const housing = useMemo(createLanternHousingGeometry, []);
  const glass = useMemo(createLanternGlassGeometry, []);
  const flame = useMemo(() => createFlameGeometry(.043, .25), []);
  const coreColor = useMemo(() => new THREE.Color(color).multiplyScalar(3.2), [color]);
  useEffect(() => () => { housing.dispose(); glass.dispose(); flame.dispose(); }, [housing, glass, flame]);
  return (
    <group position={position} scale={scale} name="authored-master-lantern-prop">
      <HeroAssetSlot id="master-lantern"><mesh geometry={housing} castShadow><TactileMaterial surface="metal" color="#504733" vertexColors metalness={.56} roughness={.6} memory={{ wear: .62, damage: .07 }} /></mesh></HeroAssetSlot>
      <mesh geometry={glass}><meshStandardMaterial color="#cbd7d1" transparent opacity={.035} roughness={.17} metalness={0} depthWrite={false} side={THREE.DoubleSide} /></mesh>
      <mesh geometry={flame} position={[0, .402, 0]}><meshBasicMaterial color={coreColor} toneMapped={false} /></mesh>
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
  const frame = useMemo<ConstructionPiece[]>(() => [
    { position: [-width * .5, height * .5, 0], size: [.42, height, depth] },
    { position: [width * .5, height * .5, 0], size: [.42, height, depth] },
    { position: [0, height, 0], size: [width + .42, .45, depth] },
    // Shallow rebates give the opening a finished edge inside its existing jambs.
    ...[-1, 1].map(side => ({ position: [side * width * .5, height * .5, -depth * .43] as Vec3, size: [.29, height - .12, .045] as Vec3 })),
  ], [width, height, depth]);
  const door = useMemo<ConstructionPiece[]>(() => {
    const w = width - .32, h = height - .5;
    return [
      ...Array.from({ length: 5 }, (_, i) => ({ position: [-w * .4 + i * w * .2, height * .48, .04] as Vec3, size: [w / 5 - .012, h, .17] as Vec3 })),
      ...[-1, 1].map(side => ({ position: [0, height * .48 + side * h * .32, -.047] as Vec3, size: [w * .91, .13, .025] as Vec3 })),
    ];
  }, [width, height]);
  return <group position={position}>
    <TimberAssembly name="worn-rebated-door-frame" pieces={frame} color={color} />
    {open ? null : <TimberAssembly name="joined-door-leaf" pieces={door} color="#44372e" />}
  </group>;
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
  const reducedMotion = useSettingsStore(state => state.reducedMotion);
  const reducedEffects = useSettingsStore(state => state.reducedEffects);
  const [width, height] = size;
  const frame = useMemo(() => createMirrorFrameGeometry(width, height), [width, height]);
  useEffect(() => () => frame.dispose(), [frame]);
  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={frame} position={[0,0,.04]}><TactileMaterial surface="wood" color={warm ? "#7d6b51" : "#655e4b"} vertexColors roughness={.76} /></mesh>
      <mesh><planeGeometry args={size} /><meshStandardMaterial color="#202827" metalness={.35} roughness={.24} /></mesh>
      <MirrorMemorySurface width={width} height={height} warm={warm} reducedMotion={reducedMotion} reducedEffects={reducedEffects} />
      {cracked ? (
        <group position={[0, 0, 0.17]} scale={[width / 4, height / 5, 1]}>
          <Beam from={[-0.15, 2.1, 0]} to={[0.12, 0.2, 0]} radius={0.008} color="#969085" opacity={.5} />
          <Beam from={[0.12, 0.2, 0]} to={[-1.25, -1.1, 0]} radius={0.008} color="#969085" opacity={.5} />
          <Beam from={[0.12, 0.2, 0]} to={[1.4, -0.45, 0]} radius={0.008} color="#969085" opacity={.5} />
          <Beam from={[0.12, 0.2, 0]} to={[0.64, -2.05, 0]} radius={0.008} color="#969085" opacity={.5} />
        </group>
      ) : null}
    </group>
  );
});

export const HouseShell = memo(function HouseShell({
  position = [0, 0, 0], size = [8, 4.8, 6], wallColor = "#5a4938",
  roofColor = "#28231e", openFront = true, rearOpening = 0,
}: {
  position?: Vec3; size?: Vec3; wallColor?: string; roofColor?: string;
  openFront?: boolean; rearOpening?: number;
}) {
  const [width, height, depth] = size;
  const architecture = useMemo(() => {
    const walls: ConstructionPiece[] = [
      { position: [-width * .5, height * .5, 0], size: [.35, height, depth] },
      { position: [width * .5, height * .5, 0], size: [.35, height, depth] },
    ];
    const gap = Math.min(width - .7, Math.max(0, rearOpening));
    if (gap > 0) for (const side of [-1, 1]) walls.push({ position: [side * (width + gap) / 4, height / 2, depth / 2], size: [(width - gap) / 2, height, .35] });
    else walls.push({ position: [0, height / 2, depth / 2], size: [width, height, .35] });
    if (!openFront) walls.push({ position: [0, height / 2, -depth / 2], size: [width, height, .3] });
    const run = width * .525, rise = width * .46, pitch = Math.atan2(rise, run);
    const roof: ConstructionPiece[] = [-1, 1].map(side => ({ position: [side * run / 2, height + rise / 2, 0], size: [Math.hypot(run, rise), .17, depth + .7], rotation: [0, 0, -side * pitch] }));
    const timber: ConstructionPiece[] = [];
    for (const side of [-1, 1]) {
      for (const z of [-depth / 2, depth / 2]) timber.push({ position: [side * (width / 2 - .11), height / 2, z], size: [.18, height, .18] });
      timber.push({ position: [side * width / 2, height - .08, 0], size: [.25, .23, depth + .4] });
      for (const z of [-depth / 2 - .24, depth / 2 + .24]) timber.push({ position: [side * run / 2, height + rise / 2 - .09, z], size: [Math.hypot(run, rise), .16, .15], rotation: [0, 0, -side * pitch] });
    }
    timber.push({ position: [0, height + rise - .08, 0], size: [.22, .22, depth + .7] });
    return { walls, roof, timber };
  }, [width, height, depth, rearOpening, openFront]);
  return <group position={position} name="constructed-plaster-and-timber-shell">
    <TimberAssembly pieces={architecture.walls} plaster color={wallColor} />
    <TimberAssembly pieces={architecture.roof} color={roofColor} />
    <TimberAssembly pieces={architecture.timber} color="#493b2e" />
  </group>;
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
  const geometry = useMemo(createKeyGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <group position={position} rotation={[Math.PI / 2, 0, .18]} scale={scale}>
    <HeroAssetSlot id="key"><mesh name="worn-warded-key" geometry={geometry} castShadow><TactileMaterial surface="metal" color={color} vertexColors metalness={.64} roughness={.48} memory={{ wear: .72, damage: .12 }} /></mesh></HeroAssetSlot>
  </group>;
});

export const StonePath = memo(function StonePath({
  color = "#625e54", count = 9, length = 12, fork = 0, y = 0,
}: { color?: string; count?: number; length?: number; fork?: number; y?: number }) {
  const forms = useMemo(() => stonePathLayout(count, length, fork, y), [count, length, fork, y]);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(createSteppingStoneGeometry, []);
  useEffect(() => () => geometry.dispose(), [geometry]);
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
  return <instancedMesh ref={mesh} name="shared-stone-path" geometry={geometry} args={[undefined, undefined, forms.length]} receiveShadow>
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
  const geometry = useMemo(() => {
    const parts = branches.map((branch, index) => createTaperedBranchGeometry([
      branch.from,
      [(branch.from[0] + branch.to[0]) * .5, (branch.from[1] + branch.to[1]) * .5 + .22, (branch.from[2] + branch.to[2]) * .5 + .16],
      branch.to,
    ], .08 + index % 2 * .035, index));
    const merged = mergeGeometries(parts, false)!;
    parts.forEach(part => part.dispose()); return merged;
  }, [density]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh geometry={geometry} name="swept-thorn-branches"><TactileMaterial surface="bark" color={color} roughness={.97} /></mesh>;
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
  const mesh = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(createFlightSilhouetteGeometry, []);
  const visibleCount = Number.isFinite(count) ? Math.min(80, Math.max(0, Math.floor(count))) : 0;
  useEffect(() => () => geometry.dispose(), [geometry]);
  useLayoutEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    for (let index = 0; index < visibleCount; index++) {
      const angle = index * 2.27;
      const radius = dispersed ? 2.4 + index * .27 : .8 + index % 5 * .22;
      object.position.set(Math.cos(angle) * radius, Math.sin(index * 1.7) * 1.1 + index * .07, Math.sin(angle) * radius * .55);
      object.rotation.set(0, -angle, Math.sin(index) * .22); object.scale.setScalar(.42); object.updateMatrix();
      mesh.current.setMatrixAt(index, object.matrix);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    mesh.current.computeBoundingSphere(); mesh.current.computeBoundingBox();
  }, [visibleCount, dispersed]);
  return <group position={[0, 5.4, -2]}>
    <instancedMesh name="shared-departing-bird-silhouettes" ref={mesh} geometry={geometry} args={[undefined, undefined, visibleCount]}>
      <meshStandardMaterial color={color} roughness={1} side={THREE.DoubleSide} />
    </instancedMesh>
  </group>;
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
