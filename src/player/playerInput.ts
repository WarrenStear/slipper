import { useEffect, useRef } from "react";

export type PlayerControlState = {
  forward: boolean; backward: boolean; left: boolean; right: boolean;
};

export function setPlayerKey(state: PlayerControlState, code: string, pressed: boolean) {
  switch (code) {
    case "KeyW": case "ArrowUp": state.forward = pressed; return true;
    case "KeyS": case "ArrowDown": state.backward = pressed; return true;
    case "KeyA": case "ArrowLeft": state.left = pressed; return true;
    case "KeyD": case "ArrowRight": state.right = pressed; return true;
    default: return false;
  }
}

export function resetPlayerKeys(state: PlayerControlState) {
  state.forward = false; state.backward = false; state.left = false; state.right = false;
}

export function usePlayerControls(enabled: boolean) {
  const keysRef = useRef<PlayerControlState>({ forward: false, backward: false, left: false, right: false });
  useEffect(() => {
    const keys = keysRef.current;
    if (!enabled) { resetPlayerKeys(keys); return; }
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable) return;
      if (setPlayerKey(keys, event.code, true)) event.preventDefault();
    };
    const handleKeyUp = (event: KeyboardEvent) => {
      if (setPlayerKey(keys, event.code, false)) event.preventDefault();
    };
    const suspend = () => resetPlayerKeys(keys);
    const visibility = () => { if (document.hidden) suspend(); };
    window.addEventListener("keydown", handleKeyDown, { passive: false });
    window.addEventListener("keyup", handleKeyUp, { passive: false });
    window.addEventListener("blur", suspend);
    window.addEventListener("pagehide", suspend);
    document.addEventListener("visibilitychange", visibility);
    return () => {
      suspend();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", suspend);
      window.removeEventListener("pagehide", suspend);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [enabled]);
  return keysRef;
}
