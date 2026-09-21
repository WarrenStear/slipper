import { useMemo, useState } from "react";
import {
  getJourneyChapterForEntry,
  journeyChapters,
} from "../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import "./AccessibleArchive.css";

export type AccessibleArchiveProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  /** Canonical reveal evidence. When supplied, visited-but-unwitnessed prose remains veiled. */
  witnessedEntryIds?: string[];
  bookmarkedEntryIds?: string[];
  /** Returns to a remembered fragment, normally in focused reading mode. */
  onOpenEntry?: (entryId: string) => void;
  /** Starts guidance for an unread fragment without changing the active entry. */
  onGuideEntry?: (entryId: string) => void;
  /** @deprecated Use onOpenEntry. Never used for unread fragments. */
  onSelectEntry?: (entryId: string) => void;
  onEnterForest?: () => void;
  onOpenSettings?: () => void;
  textJourneyAvailable?: boolean;
  canGuideEntry?: (entryId: string) => boolean;
};

function entryParagraphs(entry: Slipper3DEntry) {
  return entry.paragraphs.length > 0 ? entry.paragraphs : [entry.body];
}

export function AccessibleArchive({
  entries,
  activeEntryId,
  visitedEntryIds,
  witnessedEntryIds,
  bookmarkedEntryIds = [],
  onOpenEntry,
  onGuideEntry,
  onSelectEntry,
  onEnterForest,
  onOpenSettings,
  textJourneyAvailable = false,
  canGuideEntry,
}: AccessibleArchiveProps) {
  const [query, setQuery] = useState("");
  const [expandedEntryId, setExpandedEntryId] = useState<string | null>(null);
  const remembered = useMemo(
    () => new Set(witnessedEntryIds ?? visitedEntryIds),
    [visitedEntryIds, witnessedEntryIds],
  );
  const bookmarked = useMemo(
    () => new Set(bookmarkedEntryIds),
    [bookmarkedEntryIds],
  );
  const openRememberedEntry = onOpenEntry ?? onSelectEntry;
  const normalizedQuery = query.trim().toLowerCase();

  const chapters = useMemo(() => {
    const grouped = new Map<
      string,
      {
        id: string;
        title: string;
        number: number | null;
        entries: Slipper3DEntry[];
      }
    >(
      journeyChapters.map((chapter, chapterIndex) => [
        chapter.id,
        {
          id: chapter.id,
          title: chapter.title,
          number: chapterIndex + 1,
          entries: [],
        },
      ]),
    );

    for (const entry of entries) {
      const canonicalChapter = getJourneyChapterForEntry(entry.id);
      const searchableProse = remembered.has(entry.id)
        ? [entry.body, ...entry.paragraphs]
        : [];
      const haystack = [
        entry.title,
        canonicalChapter?.title ?? entry.chapter,
        ...entry.tags,
        ...searchableProse,
      ]
        .join(" ")
        .toLowerCase();
      if (normalizedQuery && !haystack.includes(normalizedQuery)) continue;

      const groupId = canonicalChapter?.id ?? `legacy:${entry.chapter}`;
      const chapterGroup = grouped.get(groupId) ?? {
        id: groupId,
        title: entry.chapter,
        number: null,
        entries: [],
      };
      chapterGroup.entries.push(entry);
      grouped.set(groupId, chapterGroup);
    }

    return Array.from(grouped.values()).filter((chapter) => chapter.entries.length > 0);
  }, [entries, normalizedQuery, remembered]);

  const resultCount = chapters.reduce(
    (total, chapter) => total + chapter.entries.length,
    0,
  );

  return (
    <main className="accessible-archive" id="archive-main">
      <a className="accessible-archive-skip" href="#archive-fragments">
        Skip to fragments
      </a>

      <header className="accessible-archive-header">
        <div>
          <p className="accessible-archive-kicker">semantic story archive</p>
          <h1>Slipper in the Woods</h1>
          <p>
            Every fragment is represented here without WebGL. Remembered writing
            can be read directly; unread writing stays veiled while the lantern
            offers a route.
          </p>
        </div>
        {(onEnterForest || onOpenSettings) ? (
          <nav aria-label="Archive actions">
            {onEnterForest ? (
              <button type="button" onClick={onEnterForest}>
                {textJourneyAvailable ? "Continue the text journey" : "Enter the forest"}
              </button>
            ) : null}
            {onOpenSettings ? (
              <button type="button" onClick={onOpenSettings}>
                Accessibility &amp; settings
              </button>
            ) : null}
          </nav>
        ) : null}
      </header>

      <section className="accessible-archive-search" aria-labelledby="archive-search-heading">
        <h2 id="archive-search-heading">Find a fragment</h2>
        <label htmlFor="archive-query">
          Search titles, themes, symbols, or remembered text
        </label>
        <input
          id="archive-query"
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search the archive"
        />
        <p aria-live="polite">
          {resultCount} {resultCount === 1 ? "fragment" : "fragments"} shown
        </p>
      </section>

      <div
        className="accessible-archive-chapters"
        id="archive-fragments"
        tabIndex={-1}
      >
        {chapters.map((chapter, chapterIndex) => {
          const chapterId = `archive-chapter-${chapter.id}`;
          return (
            <section
              key={chapter.id}
              className="accessible-archive-chapter"
              aria-labelledby={chapterId}
            >
              <header>
                <p>Chapter {chapter.number ?? chapterIndex + 1}</p>
                <h2 id={chapterId}>{chapter.title}</h2>
                <span>
                  {chapter.entries.length}{" "}
                  {chapter.entries.length === 1 ? "fragment" : "fragments"}
                </span>
              </header>

              <ol>
                {chapter.entries.map((entry) => {
                  const isVisited = remembered.has(entry.id);
                  const isActive = entry.id === activeEntryId;
                  const isExpanded = expandedEntryId === entry.id;
                  const bodyId = `archive-fragment-body-${entry.id}`;
                  const guideAvailable = Boolean(onGuideEntry) &&
                    (canGuideEntry?.(entry.id) ?? true);
                  const enterCurrentTextMemory = Boolean(
                    textJourneyAvailable && isActive && onEnterForest,
                  );
                  const returnAvailable = Boolean(openRememberedEntry);

                  return (
                    <li
                      key={entry.id}
                      className={`${isActive ? "is-active " : ""}${isVisited ? "is-visited" : "is-unvisited"}`.trim()}
                    >
                      <article aria-current={isActive ? "location" : undefined}>
                        <div className="accessible-archive-fragment-heading">
                          <div>
                            <p>
                              {isVisited ? "Remembered" : "Unread"}
                              {isActive ? " · Current clearing" : ""}
                              {bookmarked.has(entry.id) ? " · Bookmarked" : ""}
                            </p>
                            <h3>{entry.title}</h3>
                            <span>{getJourneyChapterForEntry(entry.id)?.title ?? entry.chapter}</span>
                          </div>

                          <div className="accessible-archive-fragment-actions">
                            {isVisited ? (
                              <>
                                <button
                                  type="button"
                                  aria-expanded={isExpanded}
                                  aria-controls={bodyId}
                                  onClick={() =>
                                    setExpandedEntryId((current) =>
                                      current === entry.id ? null : entry.id,
                                    )
                                  }
                                >
                                  {isExpanded ? "Hide text" : "Read here"}
                                </button>
                                {returnAvailable ? (
                                  <button
                                    type="button"
                                    onClick={() => openRememberedEntry?.(entry.id)}
                                    aria-label={
                                      isActive
                                        ? `Open current remembered fragment in focused reading mode: ${entry.title}`
                                        : `Return to remembered fragment: ${entry.title}`
                                    }
                                  >
                                    {isActive ? "Open focused reader" : "Return here"}
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={!guideAvailable && !enterCurrentTextMemory}
                                onClick={() => {
                                  if (enterCurrentTextMemory) onEnterForest?.();
                                  else onGuideEntry?.(entry.id);
                                }}
                                aria-label={
                                  enterCurrentTextMemory
                                    ? `Begin the text journey at unread memory: ${entry.title}`
                                    : textJourneyAvailable
                                    ? `Enter unread memory in the text journey: ${entry.title}`
                                    : `Guide through the forest to unread fragment: ${entry.title}`
                                }
                              >
                                {enterCurrentTextMemory
                                  ? "Begin here"
                                  : guideAvailable
                                    ? textJourneyAvailable ? "Enter memory" : "Ask the lantern"
                                  : "Not open yet"}
                              </button>
                            )}
                          </div>
                        </div>

                        {isVisited && isExpanded ? (
                          <div
                            className="accessible-archive-fragment-body"
                            id={bodyId}
                            tabIndex={-1}
                          >
                            {entryParagraphs(entry).map((paragraph, index) => (
                              <p key={`${entry.id}-${index}`}>{paragraph}</p>
                            ))}
                          </div>
                        ) : null}

                        {!isVisited ? (
                          <p className="accessible-archive-unread-note">
                            This fragment remains in the forest. Its title and
                            location are available, but its prose is not shown.
                          </p>
                        ) : null}
                      </article>
                    </li>
                  );
                })}
              </ol>
            </section>
          );
        })}
      </div>

      {chapters.length === 0 ? (
        <p className="accessible-archive-empty" role="status">
          No fragments match that search. Unread prose is intentionally excluded
          from search.
        </p>
      ) : null}
    </main>
  );
}

export default AccessibleArchive;
