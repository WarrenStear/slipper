import { forwardRef } from "react";
import type { PointLight } from "three";
import { useActiveScenePresence } from "./ScenePresence";

/** Nearby scenery borrows the shared sky; only the active story adds practical lights. */
export const LocalStoryLight = forwardRef<PointLight, JSX.IntrinsicElements["pointLight"]>(function LocalStoryLight(props, ref) {
  const active = useActiveScenePresence();
  return active ? <pointLight {...props} ref={ref} /> : null;
});
