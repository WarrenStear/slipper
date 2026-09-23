import type { ReactNode } from "react";
import { useSceneLook } from "./SceneLookContext";

/** Keeps standalone chapter previews compatible; canonical scenes have one rig. */
export function LegacyChapterLight({ children }: { children: ReactNode }) {
  return useSceneLook() ? null : <>{children}</>;
}
