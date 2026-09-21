import { memo } from "react";
import { IntegratedFinalTableau } from "./IntegratedFinalTableau";
import type { ChapterSceneProps } from "./types";

function LanternEpilogueChapterComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  onFinalConstellationFormationComplete,
}: ChapterSceneProps) {
  return (
    <group name="lantern-epilogue-integrated-composition">
      <IntegratedFinalTableau
        qualityProfile={qualityProfile}
        reducedEffects={reducedEffects}
        reducedMotion={reducedMotion}
        onFinalConstellationFormationComplete={
          onFinalConstellationFormationComplete
        }
      />
    </group>
  );
}

export const LanternEpilogueChapter = memo(LanternEpilogueChapterComponent);
export default LanternEpilogueChapter;
