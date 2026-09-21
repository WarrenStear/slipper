import type { Slipper3DEntry } from "./slipper3dTypes";

/**
 * Example only.
 *
 * In your real migration, keep the existing entry fields exactly as they are
 * and add only the `engine3d` block to each entry.
 */
export const exampleSlipper3DNode: Slipper3DEntry = {
  id: "fragment-001",
  title: "The Doorway Remembered Me",
  chapter: "The First Wood",
  tags: ["threshold", "forest", "memory"],
  body: "A sample body used only to demonstrate the new 3D node schema.",
  paragraphs: [
    "The path did not open. It recognised me.",
    "Somewhere between the trees, the old story became a room I could enter.",
  ],
  engine3d: {
    linkedVisualId: "visual-forest-threshold",
    environmentRadius: 50,
    cameraStart: [0, 0, 0.1],
    cameraTarget: [0, 0, -1],
    cameraFov: 65,
    textPosition: [0, 0.15, -3.2],
    textRotation: [0, 0, 0],
    textMaxWidth: 560,
    textDistanceFactor: 1.1,
    ambience: {
      backgroundColor: "#050506",
      fogColor: "#050506",
      fogNear: 12,
      fogFar: 44,
    },
    portalLocations: [
      {
        id: "portal-threshold",
        label: "threshold",
        kind: "tag",
        tag: "threshold",
        targetEntryId: "fragment-014",
        position: [-2.6, 0.1, -4.2],
        color: "#c8b38a",
        description: "Follow the threshold thread.",
      },
      {
        id: "portal-next-chapter",
        label: "next clearing",
        kind: "chapter",
        targetChapter: "The Second Wood",
        targetEntryId: "fragment-012",
        position: [2.4, -0.1, -4.5],
        color: "#9fb6ad",
        description: "Move toward the next chapter.",
      },
    ],
  },
};
