import type { SlipperGiftOverrideFile } from "./privateContentOverlay";

const overrideModules = import.meta.glob<SlipperGiftOverrideFile>(
  "../../private-content/slipperGiftOverrides.json",
  { eager: true, import: "default" },
);

const loadedOverrides = Object.values(overrideModules);

if (loadedOverrides.length > 1) {
  throw new Error("Only one private Slipper gift override file may be loaded.");
}

export const privateGiftOverrideFile = loadedOverrides[0] ?? null;
