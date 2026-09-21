import type { Slipper3DEntry } from "./slipper3dTypes";

export const PRIVATE_LINE_PLACEHOLDER = "[private line held back in this public build]";

export type SlipperGiftFragmentOverride = {
  id: string;
  expectedPlaceholderCount: number;
  body: string;
  paragraphs?: string[];
  excerpt?: string;
};

export type SlipperGiftOverrideFile = {
  version: 1;
  fragments: SlipperGiftFragmentOverride[];
};

export type SlipperGiftOverlayResult = {
  entries: Slipper3DEntry[];
  appliedFragmentIds: string[];
};

function placeholderCount(value: string) {
  return value.split(PRIVATE_LINE_PLACEHOLDER).length - 1;
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeParagraphs(body: string, paragraphs?: string[]) {
  if (paragraphs) {
    if (paragraphs.length === 0 || paragraphs.some((paragraph) => !nonEmptyString(paragraph))) {
      throw new Error("Private fragment paragraphs must contain non-empty strings.");
    }
    return paragraphs.map((paragraph) => paragraph.trim());
  }
  return body
    .split(/\n\s*\n/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

/**
 * Applies an optional private deployment overlay without changing fragment
 * identity, order, tags, visuals, or 3D metadata. Invalid overlays fail closed
 * so a private line can never be attached to the wrong public fragment.
 */
export function applySlipperGiftOverrides(
  sourceEntries: readonly Slipper3DEntry[],
  overrideFile?: SlipperGiftOverrideFile | null,
): SlipperGiftOverlayResult {
  if (!overrideFile) return { entries: [...sourceEntries], appliedFragmentIds: [] };
  if (overrideFile.version !== 1 || !Array.isArray(overrideFile.fragments)) {
    throw new Error("Private gift overrides must use schema version 1.");
  }

  const entriesById = new Map(sourceEntries.map((entry) => [entry.id, entry] as const));
  const seenIds = new Set<string>();
  const overridesById = new Map<string, SlipperGiftFragmentOverride>();

  for (const override of overrideFile.fragments) {
    if (!override || !nonEmptyString(override.id)) {
      throw new Error("Every private fragment override needs a stable fragment id.");
    }
    if (seenIds.has(override.id)) {
      throw new Error(`Private gift override ${override.id} is duplicated.`);
    }
    seenIds.add(override.id);

    const source = entriesById.get(override.id);
    if (!source) throw new Error(`Private gift override ${override.id} has no public fragment.`);
    const actualPlaceholderCount = placeholderCount(source.body);
    if (actualPlaceholderCount === 0) {
      throw new Error(`Private gift override ${override.id} cannot replace a fragment without a public redaction.`);
    }
    if (
      !Number.isInteger(override.expectedPlaceholderCount) ||
      override.expectedPlaceholderCount !== actualPlaceholderCount
    ) {
      throw new Error(
        `Private gift override ${override.id} expected ${override.expectedPlaceholderCount} redactions, found ${actualPlaceholderCount}.`,
      );
    }
    if (!nonEmptyString(override.body) || override.body.includes(PRIVATE_LINE_PLACEHOLDER)) {
      throw new Error(`Private gift override ${override.id} must provide the complete unredacted body.`);
    }
    if (override.excerpt !== undefined && !nonEmptyString(override.excerpt)) {
      throw new Error(`Private gift override ${override.id} has an invalid excerpt.`);
    }
    overridesById.set(override.id, override);
  }

  return {
    entries: sourceEntries.map((entry) => {
      const override = overridesById.get(entry.id);
      if (!override) return entry;
      const body = override.body.trim();
      const paragraphs = normalizeParagraphs(body, override.paragraphs);
      return {
        ...entry,
        body,
        paragraphs,
        excerpt: override.excerpt?.trim() ?? paragraphs[0]?.slice(0, 220) ?? body.slice(0, 220),
      };
    }),
    appliedFragmentIds: [...overridesById.keys()],
  };
}
