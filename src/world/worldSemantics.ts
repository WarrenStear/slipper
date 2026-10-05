import type { Slipper3DEntry } from "../data/slipper3dTypes.ts";
import { isChapter } from "./terrain/worldPlacement.ts";
import { CHAPTER_BLUE_MOON_ARCHIVE, CHAPTER_CROWNED_RETURN, CHAPTER_FIRE_AND_RIVER, CHAPTER_MIRROR_CLEARING, CHAPTER_THORNED_HOUSE } from "./terrain/worldConstants.ts";

export function entrySemanticSignal(entry: Slipper3DEntry) {
  return `${entry.title ?? ""} ${entry.chapter ?? ""} ${(entry.paragraphs ?? []).join(" ")} ${entry.body ?? ""} ${(entry.tags ?? []).join(" ")} ${entry.engine3d.sceneKind ?? ""} ${entry.engine3d.emotionalTone ?? ""} ${entry.engine3d.mood ?? ""}`.toLowerCase();
}

export type SemanticPathTheme = "archive" | "fire" | "water" | "threshold" | "crown" | "thorns" | "celestial";

export type SemanticThemeResult = {
  theme: SemanticPathTheme;
  score: number;
};

export const SEMANTIC_PATH_THEMES: SemanticPathTheme[] = ["archive", "fire", "water", "threshold", "crown", "thorns", "celestial"];

export const SEMANTIC_THEME_PATTERNS: Record<SemanticPathTheme, RegExp[]> = {
  archive: [/\barchives?\b/g, /\barchived\b/g, /\bmoon\b/g, /\bnight\b/g, /\bmemory\b/g, /\bmemories\b/g, /\bsilence\b/g, /\bsilent\b/g],
  fire: [/\bfire\b/g, /\bembers?\b/g, /\bburn(?:ed|ing|s)?\b/g, /\bash(?:es)?\b/g, /\bflames?\b/g, /\bsmoke\b/g],
  water: [/\bwater\b/g, /\brivers?\b/g, /\bmirrors?\b/g, /\bpools?\b/g, /\breflection\b/g, /\breflections\b/g, /\brain\b/g],
  threshold: [/\bthresholds?\b/g, /\bhouses?\b/g, /\bdoors?\b/g, /\bcrossing\b/g, /\bcrossings\b/g, /\bgates?\b/g],
  crown: [/\bcrowns?\b/g, /\breturn\b/g, /\breturns\b/g, /\breturned\b/g, /\breturning\b/g, /\bexits?\b/g, /\bgold(?:en)?\b/g],
  thorns: [/\bthorns?\b/g, /\brot\b/g, /\bdecay\b/g],
  celestial: [/\bstars?\b/g, /\bconstellation\b/g],
};

export function countPatternMatches(signal: string, patterns: RegExp[]) {
  return patterns.reduce((total, pattern) => total + (signal.match(pattern)?.length ?? 0), 0);
}

export function dominantSemanticTheme(entry: Slipper3DEntry): SemanticThemeResult {
  const signal = entrySemanticSignal(entry);
  const scores = SEMANTIC_PATH_THEMES.map((theme) => ({
    theme,
    score: countPatternMatches(signal, SEMANTIC_THEME_PATTERNS[theme]),
  }));

  const bump = (theme: SemanticPathTheme, amount: number) => {
    const target = scores.find((candidate) => candidate.theme === theme);
    if (target) target.score += amount;
  };

  if (isChapter(entry, CHAPTER_MIRROR_CLEARING)) bump("water", 10);
  if (isChapter(entry, CHAPTER_THORNED_HOUSE)) {
    bump("threshold", 6);
    bump("thorns", 8);
  }
  if (isChapter(entry, CHAPTER_BLUE_MOON_ARCHIVE)) bump("archive", 8);
  if (isChapter(entry, CHAPTER_FIRE_AND_RIVER)) bump("fire", 12);
  if (isChapter(entry, CHAPTER_CROWNED_RETURN)) bump("crown", 14);

  scores.sort((a, b) => b.score - a.score);
  const dominant = scores[0];
  if (dominant.score > 0) return dominant;

  const fallbackSignal = (entry.engine3d.sceneKind ?? "") + " " + (entry.engine3d.mood ?? "") + " " + (entry.engine3d.emotionalTone ?? "");
  if (/fire|ember|ash|burn|flame/.test(fallbackSignal)) return { theme: "fire", score: 1 };
  if (/water|river|mirror|pool|reflection/.test(fallbackSignal)) return { theme: "water", score: 1 };
  if (/threshold|house|door|crossing/.test(fallbackSignal)) return { theme: "threshold", score: 1 };
  if (/thorn|rot|decay/.test(fallbackSignal)) return { theme: "thorns", score: 1 };
  if (/star|constellation|celestial/.test(fallbackSignal)) return { theme: "celestial", score: 1 };
  if (/crown|return|exit/.test(fallbackSignal)) return { theme: "crown", score: 1 };
  return { theme: "archive", score: 0.5 };
}

