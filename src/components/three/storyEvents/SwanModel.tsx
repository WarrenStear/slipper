import { memo } from "react";
import { AuthoredNpcSilhouette } from "../environmentArt/AuthoredNpc";

/** One floor-anchored +Z-forward Swan across actor and sanctuary presentation. */
export const SwanModel = memo(function SwanModel() {
  return <group name="sculpted-story-swan"><AuthoredNpcSilhouette kind="swan" /></group>;
});
