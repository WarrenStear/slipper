import { useSceneLook } from "../artDirection/SceneLookContext";
import { useEffect, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import type { JourneySceneId } from "../../../lib/storyJourneyState";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import { resolveCinematicProfile, type CinematicStoryState } from "../../../cinematics/emotionalProfiles";
import { advanceCinematicProfile, activateCinematicProfile } from "../../../cinematics/emotionalCinematography";
import { CinematicCameraDirector } from "./CinematicCameraDirector";
import { CinematicLightingDirector } from "./CinematicLightingDirector";
import { CinematicAtmosphereDirector } from "./CinematicAtmosphereDirector";
import { useJourneyStore } from "../../../stores/useJourneyStore";

export type EmotionalCinematographyDirectorProps = CinematicStoryState & {
  sceneId: JourneySceneId; reducedMotion: boolean; cameraAssistance: boolean; focusPosition?: Vector3Tuple | null;
};

/** Standalone review adapter; the canonical owner already advances this profile. */
export function EmotionalCinematographyDirector(props: EmotionalCinematographyDirectorProps) {
  const presentation = useSceneLook();
  return presentation ? null : <LegacyEmotionalCinematography {...props} />;
}

function LegacyEmotionalCinematography({ sceneId, reducedMotion, cameraAssistance, focusPosition, lanternOwned, surrenderComplete, compression, mindReleased, creationComplete }: EmotionalCinematographyDirectorProps) {
  const nestHandsOccupied = useJourneyStore(state => Number(state.storyObjectStates["nest.protected-linen"] === "carried") + Number(state.storyObjectStates["nest.responsibility"] === "carried"));
  const nestBurdenResting = useJourneyStore(state => state.storyObjectStates["nest.responsibility"] === "placed");
  const target = useMemo(() => resolveCinematicProfile(sceneId, { lanternOwned, surrenderComplete, compression, mindReleased, creationComplete, nestHandsOccupied, nestBurdenResting }), [sceneId, lanternOwned, surrenderComplete, compression, mindReleased, creationComplete, nestHandsOccupied, nestBurdenResting]);
  useEffect(() => activateCinematicProfile(), []);
  // Advance before frame consumers; a negative priority retains R3F's render loop.
  useFrame((_, delta) => advanceCinematicProfile(target, delta), -2);
  return <group name="EmotionalCinematographyDirector" userData={{ sceneId }}>
    <CinematicCameraDirector sceneId={sceneId} reducedMotion={reducedMotion} cameraAssistance={cameraAssistance} focusPosition={focusPosition} />
    <CinematicLightingDirector />
    <CinematicAtmosphereDirector />
  </group>;
}
export default EmotionalCinematographyDirector;
