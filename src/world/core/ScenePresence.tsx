import { createContext, useContext } from "react";

/** Scenery can exist before its story is eligible. This is presentation only. */
export const ScenePresence = createContext(true);
export const useActiveScenePresence = () => useContext(ScenePresence);
