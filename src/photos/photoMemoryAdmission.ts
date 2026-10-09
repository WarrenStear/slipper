import type { Slipper3DEntry, Slipper3DVisual } from '../data/slipper3dTypes';
import { getJourneySceneForEntry } from '../data/journeyNarrative';

export type PhotoMemoryIntent = 'inspection' | 'stillness';
export type PhotoMemoryAdmission = Readonly<{
  entryId: string; visualId: string; src: string;
  orientation: Slipper3DVisual['orientation'];
  /** This is the supplied accessible source metadata, admitted only after witness. */
  alt: string;
}>;
export type PhotoMemoryGate = Readonly<{
  entryId: string; activeEntryId: string; sceneId: string;
  witnessedEntryIds: readonly string[];
  openingResolved: boolean; participating: boolean; foreground: boolean; overlayOpen: boolean;
  mode: 'explore' | 'read' | 'map'; quality: 'low' | 'medium' | 'high' | 'cinematic';
  reducedEffects: boolean; mobile: boolean;
  intent?: PhotoMemoryIntent | null;
}>;

export function isLocalPhotograph(src: string) {
  return /^\/visuals\/[^/\\?#\s]+\.(?:jpg|jpeg|png|webp)$/i.test(src)
    && !src.includes('..') && !/%(?:2e|2f|5c)/i.test(src);
}

/** Witness and live presentation gates precede even asset metadata lookup.
 * Generated/scored/index fallback links are retained but do not invent a photo relationship. */
export function resolvePhotoMemory(gate: PhotoMemoryGate,
  entries: readonly Slipper3DEntry[], visuals: readonly Slipper3DVisual[]): PhotoMemoryAdmission | null {
  if (!(gate.intent === 'inspection' || gate.intent === 'stillness') || !gate.participating || !gate.foreground || gate.overlayOpen
    || !gate.openingResolved || gate.sceneId === 'broken-floor.confession'
    || gate.mode !== 'explore' || gate.mobile || gate.reducedEffects
    || gate.quality === 'low' || gate.quality === 'medium'
    || gate.entryId !== gate.activeEntryId || !gate.witnessedEntryIds.includes(gate.entryId)) return null;
  const scene = getJourneySceneForEntry(gate.entryId);
  if (!scene || scene.id !== gate.sceneId) return null;
  const entry = entries.find(candidate => candidate.id === gate.entryId);
  if (!entry) return null;
  const explicitId = entry.linkedVisualId ?? entry.visualId ?? entry.heroVisualId;
  if (!explicitId || explicitId !== entry.engine3d.linkedVisualId) return null;
  const visual = visuals.find(candidate => candidate.id === explicitId);
  if (!visual || !isLocalPhotograph(visual.src)
    || !['portrait','landscape','square'].includes(visual.orientation)) return null;
  return Object.freeze({ entryId: entry.id, visualId: visual.id, src: visual.src,
    orientation: visual.orientation, alt: visual.alt ?? entry.title });
}

/** Fit the source photograph without stretching/cropping; existing shrine size is the ceiling. */
export function photoMemorySize(orientation: Slipper3DVisual['orientation'], aspect: number) {
  const maxWidth = orientation === 'portrait' ? 1.72 : orientation === 'square' ? 2.45 : 2.75;
  const maxHeight = orientation === 'portrait' ? 2.75 : orientation === 'square' ? 2.45 : 1.72;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : maxWidth / maxHeight;
  const width = Math.min(maxWidth, maxHeight * safeAspect);
  return Object.freeze({ width, height: width / safeAspect });
}
