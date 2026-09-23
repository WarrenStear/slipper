import { Component, Suspense, useEffect, useMemo, type ReactNode } from "react";
import { useCompressedGLTF } from "../../../lib/assets/gltfLoaders";
import { cloneNpcPresentation, isPlaceholderNpcAsset } from "../../../lib/assets/npcAssetPolicy";
import { HERO_ASSETS, productionHeroUrl, type HeroAssetId } from "./heroAssetRegistry";

class AssetBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}
function LoadedHero({ url, fallback, assetPosition, assetScale }: { url: string; fallback: ReactNode; assetPosition?: [number, number, number]; assetScale?: number }) {
  const asset = useCompressedGLTF(url);
  const placeholder = isPlaceholderNpcAsset(asset);
  const model = useMemo(() => placeholder ? null : cloneNpcPresentation(asset.scene), [placeholder, asset.scene]);
  useEffect(() => () => model?.dispose(), [model]);
  return model ? <group position={assetPosition} scale={assetScale}><primitive object={model.scene} dispose={null} /></group> : <>{fallback}</>;
}

/** A failed or unreviewed asset retains the story's authored presentation. */
export function HeroAssetSlot({ id, children, assetPosition, assetScale }: { id: HeroAssetId; children: ReactNode; assetPosition?: [number, number, number]; assetScale?: number }) {
  const url = productionHeroUrl(HERO_ASSETS[id]);
  if (!url) return <>{children}</>;
  return <AssetBoundary key={url} fallback={children}><Suspense fallback={children}><LoadedHero url={url} fallback={children} assetPosition={assetPosition} assetScale={assetScale} /></Suspense></AssetBoundary>;
}
