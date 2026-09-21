export type SlipperEntry = {
  id: string;
  title: string;
  chapter: string;
  tags: string[];
  body: string;
  paragraphs: string[];
  date?: string;
  sequence?: number;

  /** Optional fields supported by the Phase 4 migrator so your older archive file can be pasted in with minimal edits. */
  visualId?: string;
  linkedVisualId?: string;
  heroVisualId?: string;
  mood?: string;
  excerpt?: string;
};

export type SlipperVisual = {
  id: string;
  src: string;
  orientation: "portrait" | "landscape" | "square";
  alt?: string;
  chapter?: string;
  tags?: string[];
};

export type Vector3Tuple = [number, number, number];
export type EulerTuple = [number, number, number];

export type PortalKind = "tag" | "chapter" | "entry" | "visual";

export type PortalLocation = {
  /** Stable ID for rendering/keying this portal. */
  id: string;

  /** Human-readable label displayed near the portal. */
  label: string;

  /** What kind of narrative jump this portal represents. */
  kind: PortalKind;

  /** Optional tag this portal represents, e.g. "grief", "forest", "return". */
  tag?: string;

  /** Optional direct target node. */
  targetEntryId?: string;

  /** Optional chapter target for chapter-level movement. */
  targetChapter?: string;

  /** 3D placement inside the scene sphere. Keep portals 2–6 units from the camera. */
  position: Vector3Tuple;

  /** Optional portal rotation, in radians. */
  rotation?: EulerTuple;

  /** Optional accent color for the portal material/glow. */
  color?: string;

  /** Optional small line of helper copy for hover/focus states. */
  description?: string;

  /** 1–5 strength used for visual scale, opacity, and map weighting. */
  strength?: number;
};

export type SceneKind = "clearing" | "mirror" | "house" | "archive" | "river" | "crown" | "threshold" | "wood";
export type EmotionalTone = "grief" | "return" | "threshold" | "fire" | "water" | "silence" | "memory" | "revelation";
export type SpatialRole = "entrance" | "memory" | "trial" | "revelation" | "exit" | "crossing";

export type SlipperEntry3DMeta = {
  /** ID of the SlipperVisual used as the surrounding environment or shrine image. */
  linkedVisualId: string;

  /** Radius of the surrounding environment sphere. Default: 50. */
  environmentRadius?: number;

  /** Camera starting position for this narrative node. Default: [0, 0, 0.1]. */
  cameraStart?: Vector3Tuple;

  /** Soft look-at target used during scene entry. Default: [0, 0, -1]. */
  cameraTarget?: Vector3Tuple;

  /** Per-node camera field of view. Default: 65. */
  cameraFov?: number;

  /** Position of the floating text card. Default: [0, 0, -3]. */
  textPosition?: Vector3Tuple;

  /** Rotation of the floating text card, in radians. Default: [0, 0, 0]. */
  textRotation?: EulerTuple;

  /** Width of the HTML story card, in pixels. Default: 520. */
  textMaxWidth?: number;

  /** Drei Html distance factor. Smaller = larger in world space. Default: 1.15. */
  textDistanceFactor?: number;

  /** Optional mood label used by the HUD and scene tuning. */
  mood?: string;

  /** Generated prose-density hint and stable world placement used by compiled archives. */
  densityMultiplier?: number;
  worldPosition?: Vector3Tuple;

  /** Semantic placement used by the 3D renderer to choose objects, fog, portal treatment, and pacing. */
  sceneKind?: SceneKind;
  emotionalTone?: EmotionalTone;
  spatialRole?: SpatialRole;
  symbolicWeight?: 1 | 2 | 3 | 4 | 5;

  /** Two or three CSS/Three-compatible colors used by procedural domes when the linked visual is not panoramic. */
  environmentGradient?: [string, string, string?];

  /** Optional manual placement in the 2D constellation overlay. Values use SVG coordinates, usually 0-240. */
  constellationPosition?: [number, number];

  /** Atmospheric scene-level settings. */
  ambience?: {
    backgroundColor?: string;
    fogColor?: string;
    fogNear?: number;
    fogFar?: number;
  };

  /** Portal definitions. Phase 4 can auto-generate these from tags/chapters/sequence. */
  portalLocations?: PortalLocation[];
};

export type Slipper3DEntry = SlipperEntry & {
  engine3d: SlipperEntry3DMeta;
};

export type Slipper3DVisual = SlipperVisual & {
  /** How the visual should be treated by the 3D renderer. Portrait/square images become shrine planes, not stretched skyboxes. */
  environmentKind?: "equirectangular" | "flat-panorama" | "portrait-plane" | "square-plane" | "shrine-plane";

  /** Future hook for per-visual lighting or postprocessing. */
  environmentIntensity?: number;
};

export type SlipperArchiveSource = {
  entries: SlipperEntry[];
  visuals: SlipperVisual[];
};

export type ContentDiagnostics = {
  entryCount: number;
  visualCount: number;
  chapterCount: number;
  tagCount: number;
  entriesMissingParagraphs: string[];
  entriesUsingFallbackVisual: string[];
  duplicateEntryIds: string[];
  duplicateVisualIds: string[];
};
