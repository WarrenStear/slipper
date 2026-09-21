import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { useJourneyStore } from "../../../stores/useJourneyStore";
import { useSettingsStore } from "../../../stores/useSettingsStore";
import { beginOpeningPointer, consumeOpeningClick, createOpeningPointerHandoff, openingEnclosed, resetOpeningPointer } from "../../../cinematics/openingPresentation";

/** Gate only click-to-lock. Pointer events still reach the authored floor director. */
export function OpeningInteractionBoundary() {
  const { gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const handoff = createOpeningPointerHandoff();
    const enclosed = () => {
      const story = useJourneyStore.getState();
      return openingEnclosed(story.sceneId, story.storyObjectStates["broken-floor.reflection"] === "inverted"
        || story.inventory.lantern || story.completedRitualIds.includes("ritual.accept-lantern"));
    };
    const press = (event: PointerEvent) => {
      if (event.isPrimary && event.button === 0) beginOpeningPointer(handoff, enclosed());
    };
    const click = (event: MouseEvent) => {
      if (consumeOpeningClick(handoff, enclosed()) || useSettingsStore.getState().drawerOpen) {
        // A successful wipe/touch also emits click. Do not let the unrelated
        // desktop click-to-lock listener take the next gesture away from it.
        event.stopImmediatePropagation();
      }
    };
    const reset = () => resetOpeningPointer(handoff);
    const lockChanged = () => {
      if (enclosed() && document.pointerLockElement === canvas) document.exitPointerLock?.();
    };
    canvas.addEventListener("pointerdown", press, true);
    canvas.addEventListener("click", click, true);
    window.addEventListener("pointercancel", reset);
    window.addEventListener("blur", reset);
    window.addEventListener("pagehide", reset);
    document.addEventListener("pointerlockchange", lockChanged);
    lockChanged();
    return () => {
      canvas.removeEventListener("pointerdown", press, true);
      canvas.removeEventListener("click", click, true);
      window.removeEventListener("pointercancel", reset);
      window.removeEventListener("blur", reset);
      window.removeEventListener("pagehide", reset);
      document.removeEventListener("pointerlockchange", lockChanged);
    };
  }, [gl]);
  return null;
}
