import { useFrame } from "@react-three/fiber";
import type { Vector3Tuple } from "../../../data/slipper3dTypes";
import { cameraPresentationActive } from "../../../cinematics/shotComposition";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { useWorldStore } from "../../../stores/useWorldStore";
import { cameraHasAuthority } from "../../../player/cameraOwnership";
import { useCameraAssistance } from "../../../player/useCameraAssistance";

/** Standalone review compatibility only; the live world mounts CameraController. */
export function CinematicCameraDirector({ sceneId, cameraAssistance, reducedMotion, focusPosition }: {
  sceneId: string; cameraAssistance: boolean; reducedMotion: boolean; focusPosition?: Vector3Tuple | null;
}) {
  const openingOwned = useJourneyStore(state => sceneId === "broken-floor.confession" && state.storyObjectStates["broken-floor.reflection"] !== "inverted");
  const applyCameraAssistance = useCameraAssistance({ sceneId, cameraAssistance, reducedMotion, focusPosition, openingOwned,
    isActive: () => {
      const world = useWorldStore.getState();
      return cameraPresentationActive({ visible: !document.hidden, focused: document.hasFocus(), overlayOpen: useSettingsStore.getState().drawerOpen,
        mode: world.mode, controls: world.controls, physicsPaused: world.physicsPaused, sceneCurrent: useJourneyStore.getState().sceneId === sceneId });
    },
  });
  useFrame(({ camera }, delta) => {
    if (cameraHasAuthority(camera)) return;
    applyCameraAssistance(camera, delta);
  });
  return null;
}
