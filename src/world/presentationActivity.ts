export type PresentationActivity = {
  visible: boolean;
  focused: boolean;
  overlayOpen: boolean;
  mode: string;
  physicsPaused: boolean;
};

/** Presentation time advances only while this world can be attended. */
export function scenePresentationActive(activity: PresentationActivity) {
  return activity.visible && activity.focused && !activity.overlayOpen
    && activity.mode === "explore" && !activity.physicsPaused;
}
