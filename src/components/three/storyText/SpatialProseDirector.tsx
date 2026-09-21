import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { JourneyScene } from "../../../data/journeyNarrative";
import type { Slipper3DEntry, Vector3Tuple } from "../../../data/slipper3dTypes";
import { canonicalQuestionExcerpts, canonicalSpatialExcerpt } from "./spatialProse";

type Treatment = "reflected" | "water" | "ash" | "wall" | "ambient" | "constellation";
type CacheEntry = { texture: THREE.CanvasTexture; users: number };
const textureCache = new Map<string, CacheEntry>();
const CACHE_LIMIT = 12;
const ORIGIN: Vector3Tuple = [0, 0, 0];

function acquireTextTexture(text: string) {
  const existing = textureCache.get(text);
  if (existing) { existing.users += 1; return existing.texture; }
  const canvas = document.createElement("canvas");
  canvas.width = 1024; canvas.height = 512;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = "32px Georgia, serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = "#e4e7df";
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (context.measureText(next).width > 870 && line) { lines.push(line); line = word; }
      else line = next;
    }
    if (line) lines.push(line);
  }
  const lineHeight = Math.min(49, 430 / Math.max(1, lines.length));
  lines.forEach((line, index) => context.fillText(line, 512, 256 + (index - (lines.length - 1) / 2) * lineHeight));
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  textureCache.set(text, { texture, users: 1 });
  return texture;
}

function releaseTextTexture(text: string) {
  const entry = textureCache.get(text);
  if (entry) entry.users = Math.max(0, entry.users - 1);
  for (const [key, cached] of textureCache) {
    if (textureCache.size <= CACHE_LIMIT) break;
    if (cached.users === 0) { cached.texture.dispose(); textureCache.delete(key); }
  }
}

type SpatialTextProps = { text: string; position: Vector3Tuple; reducedMotion?: boolean; sourceEntryId: string };

const MaterialText = memo(function MaterialText({ text, position, treatment, reducedMotion = false, sourceEntryId }: SpatialTextProps & { treatment: Treatment }) {
  const mesh = useRef<THREE.Mesh>(null);
  const [texture, setTexture] = useState<THREE.CanvasTexture | null>(null);
  const ground = treatment === "water" || treatment === "ash";
  const uniforms = useMemo(() => ({ ink: { value: null as THREE.CanvasTexture | null }, elapsed: { value: 0 }, opacity: { value: 0 }, ripple: { value: ground ? 0.0018 : treatment === "reflected" ? 0.0007 : 0 } }), [ground, treatment]);
  const world = useMemo(() => new THREE.Vector3(), []);
  const localViewer = useMemo(() => new THREE.Vector3(), []);
  useEffect(() => {
    const loaded = acquireTextTexture(text);
    uniforms.ink.value = loaded;
    setTexture(loaded);
    return () => releaseTextTexture(text);
  }, [text, uniforms]);
  useFrame(({ camera, clock }, delta) => {
    if (!mesh.current) return;
    mesh.current.getWorldPosition(world);
    const distance = world.distanceTo(camera.position);
    localViewer.copy(camera.position);
    mesh.current.worldToLocal(localViewer);
    const facingMirror = treatment !== "reflected" || localViewer.z > 0;
    const targetOpacity = facingMirror ? Math.max(0, Math.min(0.64, (24 - distance) / 18)) : 0;
    uniforms.opacity.value += (targetOpacity - uniforms.opacity.value) * (1 - Math.exp(-Math.min(delta, 0.05) * 1.5));
    uniforms.elapsed.value = reducedMotion ? 0 : clock.elapsedTime;
  });
  if (!texture) return null;
  return <mesh ref={mesh} name={`${treatment}-canonical-prose`} position={position} rotation={ground ? [-Math.PI / 2, 0, Math.PI] : [0, Math.PI, 0]} userData={{ sourceEntryId, canonicalExcerpt: text }}>
    <planeGeometry args={ground ? [5.2, 2.6] : treatment === "reflected" ? [1.55, 0.775] : [4.8, 2.4]} />
    <shaderMaterial uniforms={uniforms} transparent depthWrite={false} side={THREE.DoubleSide}
      vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
      fragmentShader={`
        uniform sampler2D ink;
        uniform float elapsed;
        uniform float opacity;
        uniform float ripple;
        varying vec2 vUv;
        void main() {
          vec2 uv = vUv;
          uv.x += sin(uv.y * 41.0 + elapsed * 0.6) * ripple;
          vec4 word = texture2D(ink, uv);
          gl_FragColor = vec4(word.rgb, word.a * opacity);
          #include <colorspace_fragment>
        }
      `}
    />
  </mesh>;
});

export function ReflectionText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="reflected" />; }
export function WaterText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="water" />; }
export function AshText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="ash" />; }
export function WallText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="wall" />; }
export function FogText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="ambient" />; }
export function ConstellationText3D(props: SpatialTextProps) { return <MaterialText {...props} treatment="constellation" />; }

const TEXT_RENDERERS = { reflected: ReflectionText3D, water: WaterText3D, ash: AshText3D, wall: WallText3D, ambient: FogText3D, constellation: ConstellationText3D };
const LOCATIONS: Record<Treatment, Vector3Tuple> = { reflected: [0, 1.7, 2.9], water: [-0.8, 0.065, 1.8], ash: [0, 0.08, 3], wall: [0, 2.2, 5.85], ambient: [0, 1.8, 4.8], constellation: [0, 5.2, 11] };

export type SpatialProseDirectorProps = { entry?: Slipper3DEntry; scene?: JourneyScene; position?: Vector3Tuple; headingRadians?: number; active: boolean; witnessed: boolean; reducedMotion?: boolean; suppressed?: boolean };
export function SpatialProseDirector({ entry, scene, position = ORIGIN, headingRadians = 0, active, witnessed, reducedMotion = false, suppressed = false }: SpatialProseDirectorProps) {
  if (!entry || !scene || !active || !witnessed || suppressed || scene.id === "river.release-surrender") return null;
  const treatment = scene.id === "broken-floor.confession" ? "water" : scene.presentation.proseTreatment ?? "ambient";
  const Text = TEXT_RENDERERS[treatment];
  const excerpt = canonicalSpatialExcerpt(entry, treatment === "reflected" ? 95 : 230);
  const questions = scene.id === "climb.mind" ? canonicalQuestionExcerpts(entry) : [];
  return <group name="SpatialProseDirector" position={position} rotation={[0, headingRadians, 0]} userData={{ sourceEntryId: entry.id }}>
    {questions.length ? questions.map((text, index) => <FogText3D key={text} text={text} sourceEntryId={entry.id} position={[(index % 2 ? -1 : 1) * 3.1, 1.6 + index * 0.2, 2 + index * 2.8]} reducedMotion={reducedMotion} />) : <Text text={excerpt} sourceEntryId={entry.id} position={LOCATIONS[treatment]} reducedMotion={reducedMotion} />}
  </group>;
}
export default SpatialProseDirector;
