import {
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  getJourneyChapterForEntry,
  journeyChapters,
} from "../../data/journeyNarrative";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import "./ArchiveIndex.css";

export type StoryMapPane = "constellation" | "archive";

export const STORY_MAP_CONSTELLATION_PANEL_ID = "story-map-constellation-panel";
export const STORY_MAP_ARCHIVE_PANEL_ID = "story-map-archive-panel";
export const STORY_MAP_CONSTELLATION_TAB_ID = "story-map-constellation-tab";
export const STORY_MAP_ARCHIVE_TAB_ID = "story-map-archive-tab";

export type MapWorkspaceTabsProps = {
  activePane: StoryMapPane;
  onChange: (pane: StoryMapPane) => void;
  constellationPanelId?: string;
  archivePanelId?: string;
  constellationTabId?: string;
  archiveTabId?: string;
};

export type ArchiveIndexProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  /** Opens a remembered fragment in focused reading mode. */
  onOpenEntry?: (entryId: string) => void;
  /** Starts guidance for an unread fragment without changing the active entry. */
  onGuideEntry?: (entryId: string) => void;
  /** @deprecated Use onOpenEntry. Never used for unread fragments. */
  onSelectEntry?: (entryId: string) => void;
  panelId?: string;
  labelledBy?: string;
  hidden?: boolean;
};

function entryPreview(entry: Slipper3DEntry) {
  const firstParagraph = entry.paragraphs.find(Boolean) ?? entry.body ?? "";
  return firstParagraph.length > 128 ? `${firstParagraph.slice(0, 128)}…` : firstParagraph;
}

export function MapWorkspaceTabs({
  activePane,
  onChange,
  constellationPanelId = STORY_MAP_CONSTELLATION_PANEL_ID,
  archivePanelId = STORY_MAP_ARCHIVE_PANEL_ID,
  constellationTabId = STORY_MAP_CONSTELLATION_TAB_ID,
  archiveTabId = STORY_MAP_ARCHIVE_TAB_ID,
}: MapWorkspaceTabsProps) {
  const constellationTabRef = useRef<HTMLButtonElement>(null);
  const archiveTabRef = useRef<HTMLButtonElement>(null);

  const selectAndFocus = (pane: StoryMapPane) => {
    onChange(pane);
    const target = pane === "constellation" ? constellationTabRef.current : archiveTabRef.current;
    target?.focus();
  };

  const handleKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    currentPane: StoryMapPane,
  ) => {
    let nextPane: StoryMapPane | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextPane = currentPane === "constellation" ? "archive" : "constellation";
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextPane = currentPane === "archive" ? "constellation" : "archive";
    } else if (event.key === "Home") {
      nextPane = "constellation";
    } else if (event.key === "End") {
      nextPane = "archive";
    }

    if (!nextPane) return;
    event.preventDefault();
    selectAndFocus(nextPane);
  };

  return (
    <div className="map-workspace-tabs" role="tablist" aria-label="Map views">
      <button
        ref={constellationTabRef}
        id={constellationTabId}
        type="button"
        role="tab"
        aria-controls={constellationPanelId}
        aria-selected={activePane === "constellation"}
        tabIndex={activePane === "constellation" ? 0 : -1}
        onClick={() => onChange("constellation")}
        onKeyDown={(event) => handleKeyDown(event, "constellation")}
      >
        <span>Constellation</span>
        {activePane === "constellation" ? (
          <span className="map-workspace-tab-state" aria-hidden="true">Selected</span>
        ) : null}
      </button>
      <button
        ref={archiveTabRef}
        id={archiveTabId}
        type="button"
        role="tab"
        aria-controls={archivePanelId}
        aria-selected={activePane === "archive"}
        tabIndex={activePane === "archive" ? 0 : -1}
        onClick={() => onChange("archive")}
        onKeyDown={(event) => handleKeyDown(event, "archive")}
      >
        <span>Archive list</span>
        {activePane === "archive" ? (
          <span className="map-workspace-tab-state" aria-hidden="true">Selected</span>
        ) : null}
      </button>
    </div>
  );
}

export function ArchiveIndex({
  entries,
  activeEntryId,
  visitedEntryIds,
  onOpenEntry,
  onGuideEntry,
  onSelectEntry,
  panelId,
  labelledBy,
  hidden = false,
}: ArchiveIndexProps) {
  const [query, setQuery] = useState("");
  const [chapter, setChapter] = useState("all");
  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const openRememberedEntry = onOpenEntry ?? onSelectEntry;

  const chapters = useMemo(() => {
    const availableEntryIds = new Set(entries.map((entry) => entry.id));
    return journeyChapters.filter((candidate) =>
      candidate.entryIds.some((entryId) => availableEntryIds.has(entryId)),
    );
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return entries.filter((entry) => {
      const canonicalChapter = getJourneyChapterForEntry(entry.id);
      const matchesChapter = chapter === "all" || canonicalChapter?.id === chapter;
      if (!matchesChapter) return false;

      if (!normalizedQuery) return true;

      const searchableProse = visitedSet.has(entry.id)
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

      return haystack.includes(normalizedQuery);
    });
  }, [entries, chapter, query, visitedSet]);

  return (
    <aside
      className="archive-index"
      id={panelId}
      role={labelledBy ? "tabpanel" : undefined}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : "Story archive index"}
      tabIndex={labelledBy ? 0 : undefined}
      hidden={hidden}
    >
      <div className="archive-index-header">
        <div>
          <p>Story archive</p>
          <span>Remembered fragments can be read. Unread fragments offer guidance only.</span>
        </div>
        <strong aria-live="polite">{filteredEntries.length}/{entries.length}</strong>
      </div>

      <div className="archive-index-controls">
        <label>
          <span>Search</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="title, tag, remembered phrase…"
            aria-label="Search story fragments"
          />
        </label>

        <label>
          <span>Chapter</span>
          <select value={chapter} onChange={(event) => setChapter(event.target.value)} aria-label="Filter by chapter">
            <option value="all">All</option>
            {chapters.map((chapterOption) => (
              <option key={chapterOption.id} value={chapterOption.id}>{chapterOption.title}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="archive-index-list">
        {filteredEntries.length === 0 ? (
          <p className="archive-index-empty" role="status">
            No fragments match this search. Unread prose is intentionally excluded from search.
          </p>
        ) : null}
        {filteredEntries.map((entry) => {
          const canonicalChapter = getJourneyChapterForEntry(entry.id);
          const isActive = entry.id === activeEntryId;
          const isVisited = visitedSet.has(entry.id);
          const action = isVisited ? openRememberedEntry : onGuideEntry;
          const actionAvailable = Boolean(action);
          const stateLabel = isVisited
            ? isActive
              ? "Remembered · current clearing"
              : "Remembered · read again"
            : actionAvailable
              ? "Unvisited · guide available"
              : "Unvisited · guidance unavailable";
          const actionLabel = isVisited
            ? isActive
              ? `Read current remembered fragment: ${entry.title}`
              : `Return to remembered fragment: ${entry.title}`
            : `Guide through the forest to unread fragment: ${entry.title}`;

          return (
            <button
              key={entry.id}
              type="button"
              className={`archive-index-card${isActive ? " is-active" : ""}${isVisited ? " is-visited" : " is-unvisited"}`}
              onClick={() => action?.(entry.id)}
              disabled={!actionAvailable}
              aria-current={isActive ? "location" : undefined}
              aria-label={actionLabel}
            >
              <span className="archive-index-sequence">{entry.sequence ?? "—"}</span>
              <span className="archive-index-copy">
                <span className="archive-index-state">{stateLabel}</span>
                <strong>{entry.title}</strong>
                <small>{canonicalChapter?.title ?? entry.chapter} / {entry.engine3d.mood ?? "fragment"}</small>
                <em>
                  {isVisited
                    ? entryPreview(entry)
                    : "This writing remains unread. Select it to ask the lantern for a route."}
                </em>
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

export default ArchiveIndex;
