import { useCallback, useEffect, useRef, useState } from "react";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import type { SlipperConstellationScope } from "../../lib/experienceMode";
import { canReadStoryEntry } from "../../narrative/StorySelectors";

export type FragmentReaderProps = {
  entry?: Slipper3DEntry;
  witnessedEntryIds: string[];
  focusNonce: number;
  reducedMotion: boolean;
  showMetrics: boolean;
  kicker: string;
  freeWoods: boolean;
  constellationScope: SlipperConstellationScope;
  canContinue: boolean;
  bookmarked: boolean;
  backAvailable: boolean;
  nextAvailable: boolean;
  onReturnToForest: () => void;
  onFollow: () => void;
  onSettings: () => void;
  onConstellation: () => void;
  onBookmark: () => void;
  onBack: () => void;
  onNext: () => void;
  onContinue: () => void;
  onArchive: () => void;
};

/** Owns the admitted document and its local scroll/focus lifecycle. Commands stay in the shell. */
export function FragmentReader({ entry, witnessedEntryIds, focusNonce, reducedMotion,
  showMetrics, kicker, freeWoods, constellationScope, canContinue, bookmarked,
  backAvailable, nextAvailable, onReturnToForest, onFollow, onSettings,
  onConstellation, onBookmark, onBack, onNext, onContinue, onArchive }: FragmentReaderProps) {
  const readerRef = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const entryId = entry?.id ?? "";
  const admitted = canReadStoryEntry(entryId, { witnessedEntryIds });

  useEffect(() => {
    setProgress(0);
    readerRef.current?.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
  }, [admitted, reducedMotion, entryId]);
  useEffect(() => {
    if (!admitted) return;
    const timer = window.setTimeout(() => readerRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [admitted, reducedMotion, entryId, focusNonce]);
  const updateProgress = useCallback(() => {
    const element = readerRef.current;
    if (!element) return;
    const maximum = Math.max(1, element.scrollHeight - element.clientHeight);
    setProgress(Math.max(0, Math.min(100, Math.round((element.scrollTop / maximum) * 100))));
  }, []);

  if (!admitted || !entry) return null;
  const paragraphs = entry.paragraphs?.length ? entry.paragraphs : [entry.body].filter(Boolean);
  return <section className="reader-panel" id="story-content" aria-label="Focused reading mode">
    <div className="reader-panel-inner" ref={readerRef} role="document"
      aria-labelledby="focused-reader-title" tabIndex={-1} onScroll={updateProgress}>
      {showMetrics ? <div className="reader-progress" role="progressbar" aria-label="Reading progress"
        aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}>
        <i style={{ width: `${progress}%` }} />
      </div> : null}
      <p className="reader-kicker">{kicker}</p>
      <h1 id="focused-reader-title">{entry.title}</h1>
      <div className="reader-body">{paragraphs.map((paragraph, index) =>
        <p key={`${entry.id}-reader-${index}`}>{paragraph}</p>)}</div>
      <div className="reader-footer">
        <button type="button" onClick={onReturnToForest}>Return to forest</button>
        {!freeWoods && canContinue ? <button type="button" onClick={onFollow}>Follow the next path</button> : null}
        <button type="button" onClick={onSettings}>Settings</button>
        {constellationScope === "witnessed-only" ? <button type="button" onClick={onConstellation}>Constellation</button> : null}
        {freeWoods ? <>
          <button type="button" aria-pressed={bookmarked} onClick={onBookmark}>
            {bookmarked ? "Remove bookmark" : "Bookmark location"}</button>
          <button type="button" onClick={onBack} disabled={!backAvailable}>Back</button>
          <button type="button" onClick={onNext} disabled={!nextAvailable}>Next fragment</button>
          <button type="button" onClick={onContinue} disabled={!canContinue}>Continue story</button>
          <button type="button" onClick={onConstellation}>Open map</button>
          <button type="button" onClick={onArchive}>Open archive</button>
        </> : null}
      </div>
    </div>
  </section>;
}
