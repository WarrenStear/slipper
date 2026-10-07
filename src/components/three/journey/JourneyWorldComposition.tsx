import type { QuietGuidanceActivity } from "../../../ui/quietGuidancePresentation";
import { memo } from "react";
import { TactileDetailProvider } from "../storyEvents/TactileMaterial";
import { openingEnclosed } from "../../../cinematics/openingPresentation";
import { OpeningInteractionBoundary } from "./OpeningInteractionBoundary";
import type {
  JourneySceneId,
  WorldPoint3,
} from "../../../data/journeyWorldLayout.ts";
import type { RenderQualityProfile } from "../renderQuality";
import { JourneySceneDirector } from "./JourneySceneDirector";

export type JourneyWorldCompositionProps = {
  activeSceneId: JourneySceneId | null | undefined;
  qualityProfile: RenderQualityProfile;
  reducedEffects?: boolean;
  reducedMotion?: boolean;
  activeOrigin?: WorldPoint3;
  renderAdjacent?: boolean;
  enabled?: boolean;
  openingResolved?: boolean;
  interactionsEnabled?: boolean;
  quietGuidanceActivity?: QuietGuidanceActivity;
  onFinalConstellationFormationComplete?: () => void;
};

/**
 * Single integration point for authored narrative geography.
 *
 * Mount this inside the existing Canvas/Physics tree. The component owns no
 * story state and performs no navigation; it renders the supplied active scene
 * at full fidelity and immediate route neighbors as lightweight silhouettes.
 */
function JourneyWorldCompositionComponent({
  activeSceneId,
  qualityProfile,
  reducedEffects = false,
  reducedMotion = false,
  activeOrigin,
  renderAdjacent = true,
  enabled = true,
  openingResolved = true,
  interactionsEnabled = true,
  quietGuidanceActivity,
  onFinalConstellationFormationComplete,
}: JourneyWorldCompositionProps) {
  if (!enabled || !activeSceneId) return null;

  return (
    <TactileDetailProvider quality={qualityProfile.quality} reducedEffects={reducedEffects}>
    {interactionsEnabled ? <OpeningInteractionBoundary /> : null}
    <JourneySceneDirector
      activeSceneId={activeSceneId}
      qualityProfile={qualityProfile}
      reducedEffects={reducedEffects}
      reducedMotion={reducedMotion}
      activeOrigin={activeOrigin}
      renderAdjacent={renderAdjacent && !openingEnclosed(activeSceneId, openingResolved)}
      openingResolved={openingResolved}
      interactionsEnabled={interactionsEnabled}
      quietGuidanceActivity={quietGuidanceActivity}
      onFinalConstellationFormationComplete={
        onFinalConstellationFormationComplete
      }
    />
    </TactileDetailProvider>
  );
}

export const JourneyWorldComposition = memo(JourneyWorldCompositionComponent);
export default JourneyWorldComposition;
