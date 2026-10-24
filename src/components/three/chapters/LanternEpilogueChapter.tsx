import { useActiveScenePresence } from "../../../world/core/ScenePresence";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { SceneGround } from "./ChapterPrimitives";
import { memo } from "react";
import { IntegratedFinalTableau } from "./IntegratedFinalTableau";
import type { ChapterSceneProps } from "./types";

function LanternEpilogueChapterComponent({
  qualityProfile,
  reducedEffects,
  reducedMotion,
  onFinalConstellationFormationComplete,
}: ChapterSceneProps) {
  const active = useActiveScenePresence();
  const completed = useJourneyStore(state => state.storyCompleted);
  if (!active && !completed) return <SceneGround radius={16} color="#6e7155" />;
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
