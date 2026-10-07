import type { StorySurface, TactileDetail } from "../storyEvents/tactileShader.ts";

export type MaterialMapCoordinates = {
  constructionCoordinates?: boolean;
  barkCoordinates?: boolean;
  /** Explicit receiving-mesh UV contract. Asset approval stays in MATERIAL_MAPS. */
  reviewedCoordinates?: boolean;
};

/** Delivery policy only; it creates no textures, UVs, render passes or story state. */
export function admitsProductionMaterialMaps(
  surface: StorySurface,
  inheritedDetail: TactileDetail,
  requestedDetail: TactileDetail,
  coordinates: MaterialMapCoordinates = {},
  borrowedMaps = false,
) {
  if (inheritedDetail !== "relief" || requestedDetail !== "relief" || borrowedMaps) return false;
  if (surface === "bark") return coordinates.barkCoordinates === true;
  if (surface === "wood" || surface === "wet-wood") return coordinates.constructionCoordinates === true;
  return coordinates.reviewedCoordinates === true;
}
