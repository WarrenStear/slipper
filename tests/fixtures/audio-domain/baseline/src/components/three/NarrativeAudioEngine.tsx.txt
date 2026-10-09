import type { NarrativeWorldState } from "./StoryScene";
import type { RenderQualityProfile } from "./renderQuality";
import { NarrativeAudioDirector } from "./audio/NarrativeAudioDirector";

type NarrativeAudioEngineProps = {
  narrativeWorldState: NarrativeWorldState;
  qualityProfile: RenderQualityProfile;
  enabled?: boolean;
};

/** Legacy entry point delegates to the same SceneLook-directed environment audio. */
export function NarrativeAudioEngine({ qualityProfile, enabled = true }: NarrativeAudioEngineProps) {
  return <NarrativeAudioDirector qualityProfile={qualityProfile} enabled={enabled} />;
}

export default NarrativeAudioEngine;
