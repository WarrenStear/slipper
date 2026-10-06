// Historical import path retained for existing ordinary forest consumers.
// Construction and library topology are owned by the world forest module.
export {
  createForestTrunkGeometry,
  createOrganicCrownGeometry,
  createForestTrunkLibrary,
  createForestCrownLibrary,
  createForestArchetypeGeometry,
  getForestArchetypeBranchSupports,
  FOREST_ARCHETYPES,
  FOREST_REFERENCE_TRUNK_SCALE,
  FOREST_REFERENCE_CROWN_SCALE,
  FOREST_REFERENCE_CROWN_HEIGHT,
} from "../../../world/forest/forestGeometry.ts";
export type { ForestArchetypeId, ForestGeometryDetail } from "../../../world/forest/forestGeometry.ts";
