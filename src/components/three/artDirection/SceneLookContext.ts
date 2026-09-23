import { createContext, useContext } from "react";
import type { SceneLook } from "./SceneLookRegistry";

export type ScenePresentation = {
  look: SceneLook;
  reducedMotion: boolean;
  reducedEffects: boolean;
  motion: SceneLook["motion"];
  time: { vegetation: number; cloth: number; water: number; particles: number; flame: number };
};
export const SceneLookContext = createContext<ScenePresentation | null>(null);
export const useSceneLook = () => useContext(SceneLookContext);
