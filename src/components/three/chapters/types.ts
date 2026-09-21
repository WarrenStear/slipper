import type { JourneySceneLayout, WorldPoint3 } from "../../../data/journeyWorldLayout.ts";
import type { RenderQualityProfile } from "../renderQuality";

export type ChapterSceneProps = {
  scene: JourneySceneLayout;
  qualityProfile: RenderQualityProfile;
  reducedEffects: boolean;
  reducedMotion: boolean;
  openingResolved?: boolean;
  onFinalConstellationFormationComplete?: () => void;
};

export type ChapterScenePlacement = {
  /** Optional world-space position at which the active scene anchor is placed. */
  activeOrigin?: WorldPoint3;
};
