import { Component, Suspense, useCallback, useEffect, useMemo, type ReactNode } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { TactileMaterial, useTactileDetail } from "../storyEvents/TactileMaterial";
import { applyTactileShader } from "../storyEvents/tactileShader";

type Props = { radius: number; color: string; roughness: number; metalness: number };
class GroundMapBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function MappedGround({ radius, color, roughness, metalness }: Props) {
  // Reuse the existing compressed terrain art, not a second texture library.
  const source = useTexture("/textures/forest/ground-albedo-v3.webp");
  const detail = useTactileDetail();
  const map = useMemo(() => {
    const texture = source.clone(); texture.colorSpace = THREE.SRGBColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(radius * 2 / 3.4, radius * 2 / 3.4);
    texture.anisotropy = 4; texture.needsUpdate = true; return texture;
  }, [source, radius]);
  useEffect(() => () => map.dispose(), [map]);
  const compile = useCallback((shader: Parameters<THREE.MeshStandardMaterial["onBeforeCompile"]>[0]) => {
    applyTactileShader(shader, "earth", detail);
  }, [detail]);
  const key = useCallback(() => `sidtw-chapter-ground-v1-${detail}`, [detail]);
  return <meshStandardMaterial key={key()} map={map} color={color} roughness={roughness} metalness={metalness}
    onBeforeCompile={compile} customProgramCacheKey={key} />;
}

/** A material-only fallback keeps a slow or failed optional image from removing
 * the chapter. Every consumer owns its transform clone, never the cached source. */
export function ChapterGroundMaterial(props: Props) {
  const fallback = <TactileMaterial surface="earth" color={props.color} roughness={props.roughness} metalness={props.metalness} />;
  return <GroundMapBoundary fallback={fallback}><Suspense fallback={fallback}><MappedGround {...props} /></Suspense></GroundMapBoundary>;
}
