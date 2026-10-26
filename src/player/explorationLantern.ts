import { createContext, useContext } from "react";

/** A presentation override after the ending; never rewrites the placed memory. */
export const ExplorationLanternContext = createContext(false);
export const useExplorationLanternCarried = () => useContext(ExplorationLanternContext);

export function carriesExplorationLantern(mode: string, freeWoods: boolean) {
  return mode === "explore" && freeWoods;
}
