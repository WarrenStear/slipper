import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useCompressedGLTF } from "../../lib/assets/gltfLoaders";
import { cloneNpcPresentation, isPlaceholderNpcAsset } from "../../lib/assets/npcAssetPolicy.ts";
import { AuthoredNpcSilhouette, type AuthoredNpcKind } from "./environmentArt/AuthoredNpc";

type OptimizedNpcModelProps = {
  kind: AuthoredNpcKind;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  opacity?: number;
};
const MODEL_PATHS = { wolf: "/models/wolf.glb", phantom: "/models/phantom.glb", swan: "/models/swan.glb" } as const;

class NpcAssetBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function LoadedNpc({ kind, opacity }: { kind: AuthoredNpcKind; opacity: number }) {
  const gltf = useCompressedGLTF(MODEL_PATHS[kind]);
  const placeholder = isPlaceholderNpcAsset(gltf);
  const model = useMemo(() => placeholder ? null : cloneNpcPresentation(gltf.scene, opacity), [gltf.scene, opacity, placeholder]);
  useEffect(() => () => model?.dispose(), [model]);
  if (!model) return <AuthoredNpcSilhouette kind={kind} opacity={opacity} />;
  return <primitive object={model.scene} dispose={null} />;
}

/** Production GLBs drop in without changing the authored interaction or actor interface. */
export function OptimizedNpcModel({ kind, position = [0, 0, 0], rotation = [0, 0, 0], scale = 1, opacity = 1 }: OptimizedNpcModelProps) {
  const fallback = <AuthoredNpcSilhouette kind={kind} opacity={opacity} />;
  return <group position={position} rotation={rotation} scale={scale}>
    <NpcAssetBoundary key={kind} fallback={fallback}><Suspense fallback={fallback}><LoadedNpc kind={kind} opacity={opacity} /></Suspense></NpcAssetBoundary>
  </group>;
}
