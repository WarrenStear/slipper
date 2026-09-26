import { createContext, useContext } from "react";
import type { SceneLook } from "./SceneLookRegistry";

export type ScenePresentation = {
  look: SceneLook;
  reducedMotion: boolean;
  reducedEffects: boolean;
  /** Chapter transform shared by local air and its motivated sources. */
  origin?: [number, number, number];
  heading?: number;
  motion: SceneLook["motion"];
  /** Shared eased quietness, including its release when leaving a quiet scene. */
  stillness: number;
  time: { vegetation: number; cloth: number; water: number; particles: number; flame: number };
};
export const SceneLookContext = createContext<ScenePresentation | null>(null);
export const useSceneLook = () => useContext(SceneLookContext);
