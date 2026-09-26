import { type ReactNode } from "react";
import { useHeroPresentation } from "../../../lib/assets/gltfLoaders";
import { type HeroAssetId } from "./heroAssetRegistry";

/** A failed, pending or unreviewed asset retains the story's authored presentation.
 * Imported scenes never add animation, collision, interaction or story controllers. */
export function HeroAssetSlot({ id, children, assetPosition, assetScale }: { id: HeroAssetId; children: ReactNode; assetPosition?: [number, number, number]; assetScale?: number }) {
  const model = useHeroPresentation(id);
  return model ? <group position={assetPosition} scale={assetScale}><primitive object={model} dispose={null} /></group> : <>{children}</>;
}
