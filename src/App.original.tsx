import { useEffect, useMemo, useState } from "react";
import WorldCanvas from "./components/three/WorldCanvas";
import type { NarrativeWorldState, StorySceneControls, StorySceneMode } from "./components/three/StoryScene";
import ArchiveIndex from "./components/ui/ArchiveIndex";
import ConstellationMap from "./components/ui/ConstellationMap";
import { contentDiagnostics, entries, visuals } from "./data/slipperContent";
import type { PortalLocation, Slipper3DEntry } from "./data/slipper3dTypes";
import { clearStoredJourney, loadStoredJourney, saveStoredJourney } from "./lib/journeyStorage";
import {
  getChapterProgress,
  getEntryAdjacency,
  getEntryById,
  getNextEntry,
  getScenePortals,
} from "./lib/storyGraph";
import "./styles.css";

const FIRST_ENTRY_ID = entries[0]?.id ?? "";
const VALID_ENTRY_IDS = entries.map((entry) => entry.id);

type AppMode = StorySceneMode;

type PortalCard = {
  portal: PortalLocation;
  target?: Slipper3DEntry;
  shortcut: number;
  isVisited: boolean;
};

function modeLabel(mode: AppMode) {
  if (mode === "explore") return "Explore";
  if (mode === "read") return "Read";
  return "Map";
}

function entryParagraphs(entry?: Slipper3DEntry) {
  if (!entry) return [];
  return entry.paragraphs?.length ? entry.paragraphs : [entry.body].filter(Boolean);
}

function shortTitle(title?: string, limit = 28) {
  if (!title) return "Unknown";
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function portalActionLabel(portal: PortalLocation) {
  if (portal.kind === "entry") return "Step through";
  if (portal.kind === "tag") return "Follow the thread";
  if (portal.kind === "chapter") return "Cross the threshold";
  if (portal.kind === "visual") return "Enter image-memory";
  return "Open";
}

function portalDockLine(target?: Slipper3DEntry, portal?: PortalLocation) {
  if (target) return `${shortTitle(target.title, 34)} / ${sceneLabel(target)}`;
  if (portal?.description) return portal.description;
  return "The wood has left this path unnamed.";
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function entrySignal(entry: Slipper3DEntry) {
  return `${entry.tags.join(" ")} ${entry.engine3d.emotionalTone ?? ""} ${entry.engine3d.mood ?? ""} ${entry.engine3d.sceneKind ?? ""}`.toLowerCase();
}

function buildNarrativeWorldState({
  activeEntryId,
  history,
  visitedEntryIds,
}: {
  activeEntryId: string;
  history: string[];
  visitedEntryIds: string[];
}): NarrativeWorldState {
  const entryMap = new Map(entries.map((entry) => [entry.id, entry]));
  const journeyTrace = [...history, activeEntryId].map((entryId) => entryMap.get(entryId)).filter(Boolean) as Slipper3DEntry[];
  const uniqueVisited = new Set(visitedEntryIds);

  let fire = 0;
  let water = 0;
  let memory = 0;
  let threshold = 0;
  let crown = 0;
  let symbolicWeight = 0;

  for (const entry of journeyTrace) {
    const signal = entrySignal(entry);
    if (/fire|ember|ash|burn|flame/.test(signal)) fire += 1;
    if (/water|mirror|river|pool|reflection/.test(signal)) water += 1;
    if (/memory|archive|moon|night|stars|silence/.test(signal)) memory += 1;
    if (/threshold|house|door|first|crossing/.test(signal)) threshold += 1;
    if (/crown|return|exit|revelation/.test(signal)) crown += 1;
    symbolicWeight += entry.engine3d.symbolicWeight ?? 3;
  }

  const traceLength = Math.max(1, journeyTrace.length);
  const weightedAverage = symbolicWeight / traceLength / 5;
  const fireWaterTotal = Math.max(1, fire + water);
  const fireWaterBalance = Math.max(-1, Math.min(1, (fire - water) / fireWaterTotal));
  const explorationDepth = clamp01(Math.log2(traceLength + 1) / 6 + (uniqueVisited.size / Math.max(1, entries.length)) * 0.35 + weightedAverage * 0.15);
  const memoryPressure = clamp01((memory + threshold * 0.55 + crown * 0.8) / traceLength);

  return {
    visitedCount: uniqueVisited.size,
    totalCount: entries.length,
    traceCount: traceLength,
    fireCount: fire,
    waterCount: water,
    memoryCount: memory,
    thresholdCount: threshold,
    crownCount: crown,
    fireWaterBalance,
    explorationDepth,
    memoryPressure,
    symbolicWeight: weightedAverage,
  };
}

function sceneLabel(entry?: Slipper3DEntry) {
  if (!entry) return "Unknown clearing";
  return entry.engine3d.sceneKind ?? entry.engine3d.mood ?? "fragment";
}

type NarrativeCue = {
  title: string;
  line: string;
  instruction: string;
  axis: string;
};

function narrativeSignal(entry?: Slipper3DEntry) {
  if (!entry) return "";
  return `${entry.title} ${entry.chapter} ${entry.tags.join(" ")} ${entry.body} ${entry.engine3d.emotionalTone ?? ""} ${entry.engine3d.mood ?? ""} ${entry.engine3d.sceneKind ?? ""}`.toLowerCase();
}

function buildNarrativeCue(entry: Slipper3DEntry | undefined, state: NarrativeWorldState): NarrativeCue {
  const signal = narrativeSignal(entry);
  const chapter = entry?.chapter ?? "the archive";

  if (/mirror|river|water|reflection/.test(signal)) {
    return {
      title: "The water keeps the shape.",
      line: "Move slowly here. The clearing answers in reflection, not instruction.",
      instruction: "Walk until a portal brightens; enter only when the echo feels earned.",
      axis: "water / reflection",
    };
  }

  if (/fire|ember|ash|flame|burn/.test(signal)) {
    return {
      title: "The ash still glows.",
      line: "This place is not finished with what it has carried. The path ahead opens through heat, residue, and return.",
      instruction: "Follow the warm halo. The closest threshold will widen as you approach.",
      axis: "fire / ash",
    };
  }

  if (/archive|moon|night|star|memory|silence/.test(signal)) {
    return {
      title: "The archive is breathing.",
      line: "Each clearing remembers the ones before it. The sky darkens as the journey gathers weight.",
      instruction: "Use the map when the stars crowd; use the portal when the room begins to listen.",
      axis: "memory / archive",
    };
  }

  if (/threshold|house|door|crossing|first/.test(signal)) {
    return {
      title: "The threshold is listening.",
      line: "The story is not a corridor. It is a series of rooms that ask to be entered with attention.",
      instruction: "Click into the scene, walk with WASD or arrows, and let the doorway take you when you are close enough.",
      axis: "threshold / crossing",
    };
  }

  if (/crown|return|exit|revelation/.test(signal)) {
    return {
      title: "The crown is not an ending.",
      line: "Return is a shape the wood learns to make around you. The route behind you now affects the light ahead.",
      instruction: "Look for the brightest ring. It marks the next refusal to stay still.",
      axis: "return / revelation",
    };
  }

  return {
    title: state.visitedCount > 1 ? "The wood remembers you." : "The wood has opened.",
    line: `${chapter} is now part of the path. What you have already touched remains in the atmosphere.`,
    instruction: "Walk into a portal to continue, or press F to stop and read the fragment as text.",
    axis: "wood / memory",
  };
}

function journeyPressureLabel(state: NarrativeWorldState) {
  if (state.memoryPressure > 0.68) return "memory-heavy";
  if (state.explorationDepth > 0.62) return "deep trail";
  if (state.fireWaterBalance > 0.35) return "fire-led";
  if (state.fireWaterBalance < -0.35) return "water-led";
  return "balanced crossing";
}

export default function App() {
  const storedJourney = useMemo(() => loadStoredJourney(VALID_ENTRY_IDS, FIRST_ENTRY_ID), []);
  const [activeEntryId, setActiveEntryId] = useState(storedJourney.activeEntryId);
  const [history, setHistory] = useState<string[]>(storedJourney.history);
  const [visitedEntryIds, setVisitedEntryIds] = useState<string[]>(storedJourney.visitedEntryIds);
  const [transitioning, setTransitioning] = useState(false);
  const [controls, setControls] = useState<StorySceneControls>("walk");
  const [mode, setMode] = useState<AppMode>("explore");

  const activeEntry = useMemo(() => getEntryById(entries, activeEntryId) ?? entries[0], [activeEntryId]);
  const activePortals = useMemo(() => (activeEntry ? getScenePortals(activeEntry, entries) : []), [activeEntry]);
  const nextEntry = useMemo(() => (activeEntry ? getNextEntry(entries, activeEntry.id) : undefined), [activeEntry]);
  const adjacency = useMemo(
    () => (activeEntry ? getEntryAdjacency(entries, activeEntry.id) : undefined),
    [activeEntry],
  );
  const chapterProgress = useMemo(() => getChapterProgress(entries, visitedEntryIds), [visitedEntryIds]);
  const activeVisual = useMemo(
    () => visuals.find((visual) => visual.id === activeEntry?.engine3d.linkedVisualId),
    [activeEntry],
  );

  const visitedSet = useMemo(() => new Set(visitedEntryIds), [visitedEntryIds]);
  const narrativeWorldState = useMemo(
    () => buildNarrativeWorldState({ activeEntryId: activeEntry?.id ?? activeEntryId, history, visitedEntryIds }),
    [activeEntry?.id, activeEntryId, history, visitedEntryIds],
  );
  const portalCards = useMemo<PortalCard[]>(
    () =>
      activePortals.map((portal, index) => {
        const target = portal.targetEntryId ? getEntryById(entries, portal.targetEntryId) : undefined;
        return {
          portal,
          target,
          shortcut: index + 1,
          isVisited: Boolean(target?.id && visitedSet.has(target.id)),
        };
      }),
    [activePortals, visitedSet],
  );

  const recentBreadcrumbs = useMemo(
    () =>
      history
        .slice(-4)
        .map((entryId) => getEntryById(entries, entryId))
        .filter(Boolean) as Slipper3DEntry[],
    [history],
  );

  const navigateToEntry = (targetEntryId: string, nextMode: AppMode = mode) => {
    if (!targetEntryId || targetEntryId === activeEntryId || !getEntryById(entries, targetEntryId)) return;

    setTransitioning(true);

    window.setTimeout(() => {
      setHistory((previous) => [...previous, activeEntryId].slice(-16));
      setActiveEntryId(targetEntryId);
      setVisitedEntryIds((previous) => (previous.includes(targetEntryId) ? previous : [...previous, targetEntryId]));
      setMode(nextMode);

      window.setTimeout(() => setTransitioning(false), 340);
    }, 170);
  };

  const goBack = () => {
    const previousEntryId = history.length > 0 ? history[history.length - 1] : undefined;
    if (!previousEntryId) return;

    setTransitioning(true);

    window.setTimeout(() => {
      setHistory((previous) => previous.slice(0, -1));
      setActiveEntryId(previousEntryId);
      setVisitedEntryIds((previous) => (previous.includes(previousEntryId) ? previous : [...previous, previousEntryId]));
      window.setTimeout(() => setTransitioning(false), 340);
    }, 170);
  };

  const resetJourney = () => {
    if (!FIRST_ENTRY_ID) return;
    clearStoredJourney();
    setHistory([]);
    setActiveEntryId(FIRST_ENTRY_ID);
    setVisitedEntryIds([FIRST_ENTRY_ID]);
    setMode("explore");
  };

  const continueToNext = () => {
    if (nextEntry) navigateToEntry(nextEntry.id, mode);
  };

  const moveToPrevious = () => {
    if (history.length > 0) {
      goBack();
      return;
    }

    if (adjacency?.previous) navigateToEntry(adjacency.previous.id, mode);
  };

  useEffect(() => {
    saveStoredJourney({ activeEntryId, history, visitedEntryIds });
  }, [activeEntryId, history, visitedEntryIds]);

  useEffect(() => {
    const preloadSources = new Set<string>();
    if (activeVisual?.src) preloadSources.add(activeVisual.src);

    for (const portal of activePortals) {
      const target = portal.targetEntryId ? getEntryById(entries, portal.targetEntryId) : undefined;
      const targetVisual = target ? visuals.find((visual) => visual.id === target.engine3d.linkedVisualId) : undefined;
      if (targetVisual?.src) preloadSources.add(targetVisual.src);
    }

    if (adjacency?.next) {
      const nextVisual = visuals.find((visual) => visual.id === adjacency.next?.engine3d.linkedVisualId);
      if (nextVisual?.src) preloadSources.add(nextVisual.src);
    }

    const images = Array.from(preloadSources).map((src) => {
      const image = new Image();
      image.decoding = "async";
      image.loading = "eager";
      image.src = src;
      return image;
    });

    return () => {
      images.length = 0;
    };
  }, [activePortals, activeVisual, adjacency]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.isContentEditable;
      if (isTyping) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setMode("explore");
      }

      const isWalkExploring = mode === "explore" && controls === "walk";

      if (event.key.toLowerCase() === "b" || (event.key === "ArrowLeft" && !isWalkExploring)) {
        event.preventDefault();
        moveToPrevious();
      }

      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        resetJourney();
      }

      if (event.key.toLowerCase() === "m" || event.key.toLowerCase() === "i") {
        event.preventDefault();
        setMode((current) => (current === "map" ? "explore" : "map"));
      }

      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        setMode("explore");
      }

      if (event.key.toLowerCase() === "f" || event.key === "Enter") {
        event.preventDefault();
        setMode("read");
      }

      if (event.key === "ArrowRight" && !isWalkExploring) {
        event.preventDefault();
        continueToNext();
      }

      const numericShortcut = Number(event.key);
      if (mode === "explore" && Number.isInteger(numericShortcut) && numericShortcut > 0) {
        const portal = activePortals[numericShortcut - 1];
        if (portal?.targetEntryId) {
          event.preventDefault();
          navigateToEntry(portal.targetEntryId, "explore");
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activePortals, activeEntryId, history, mode, controls, nextEntry, adjacency]);

  const visitedCount = visitedEntryIds.length;
  const totalCount = entries.length;
  const paragraphs = entryParagraphs(activeEntry);
  const currentChapterEntries = adjacency?.chapterEntries ?? [];
  const currentChapterIndex = adjacency?.chapterIndex ?? -1;
  const currentChapterProgress = currentChapterEntries.length > 0 ? currentChapterIndex + 1 : 0;
  const narrativeCue = useMemo(() => buildNarrativeCue(activeEntry, narrativeWorldState), [activeEntry, narrativeWorldState]);
  const journeyPressure = journeyPressureLabel(narrativeWorldState);
  const hasDiagnosticsWarning =
    contentDiagnostics.entriesMissingParagraphs.length > 0 ||
    contentDiagnostics.duplicateEntryIds.length > 0 ||
    contentDiagnostics.duplicateVisualIds.length > 0;

  return (
    <main className={`app-shell app-mode-${mode}`}>
      <WorldCanvas
        entryId={activeEntry?.id ?? FIRST_ENTRY_ID}
        entries={entries}
        visuals={visuals}
        visitedEntryIds={visitedEntryIds}
        onPortalSelect={(entryId) => navigateToEntry(entryId, "explore")}
        onMapSelectEntry={(entryId) => navigateToEntry(entryId, "map")}
        controls={controls}
        mode={mode}
        narrativeWorldState={narrativeWorldState}
      />

      <section className="story-hud" aria-label="Story navigation">
        <div className="story-hud-copy">
          <p className="story-hud-kicker">Slipper in the Woods / the wood remembers</p>
          <h2>{activeEntry?.title ?? "Unknown clearing"}</h2>
          <p>
            {activeEntry?.chapter ?? "No chapter"}
            {activeEntry?.engine3d.mood ? ` / ${activeEntry.engine3d.mood}` : ""}
          </p>
          <p className="story-hud-stats">
            {visitedCount}/{totalCount} seen / {contentDiagnostics.visualCount} visuals / {contentDiagnostics.chapterCount} chapters
          </p>
        </div>

        <div className="story-mode-switch" role="tablist" aria-label="Story modes">
          {(["explore", "read", "map"] as AppMode[]).map((candidateMode) => (
            <button
              key={candidateMode}
              type="button"
              className={mode === candidateMode ? "is-active" : ""}
              onClick={() => setMode(candidateMode)}
              aria-selected={mode === candidateMode}
            >
              {modeLabel(candidateMode)}
            </button>
          ))}
        </div>

        <div className="story-hud-actions">
          <button type="button" onClick={moveToPrevious} disabled={history.length === 0 && !adjacency?.previous}>
            Back
          </button>
          <button type="button" onClick={continueToNext} disabled={!nextEntry}>
            Next
          </button>
          <button type="button" onClick={resetJourney}>
            Reset
          </button>
          <button type="button" onClick={() => setControls((current) => (current === "walk" ? "orbit" : "walk"))}>
            {controls === "walk" ? "Orbit" : "Walk"}
          </button>
        </div>
      </section>

      {mode === "explore" ? (
        <section className="narrative-veil" aria-label="Narrative guidance">
          <div className="narrative-veil-orb" aria-hidden="true" />
          <div className="narrative-veil-copy">
            <p>{narrativeCue.axis}</p>
            <h3>{narrativeCue.title}</h3>
            <span>{narrativeCue.line}</span>
            <em>{narrativeCue.instruction}</em>
          </div>
          <div className="narrative-veil-meter" aria-label={`Journey pressure: ${journeyPressure}`}>
            <strong>{journeyPressure}</strong>
            <i style={{ width: `${Math.round(narrativeWorldState.explorationDepth * 100)}%` }} />
          </div>
        </section>
      ) : null}

      {mode === "explore" ? (
        <section className="journey-trail" aria-label="Journey breadcrumb trail">
          <span className="journey-trail-label">Trail</span>
          {recentBreadcrumbs.map((entry) => (
            <button key={entry.id} type="button" onClick={() => navigateToEntry(entry.id, "explore")}>
              {shortTitle(entry.title, 18)}
            </button>
          ))}
          <strong>{shortTitle(activeEntry?.title, 24)}</strong>
        </section>
      ) : null}

      {mode === "map" ? (
        <section className="map-workspace" aria-label="Story map workspace">
          <ConstellationMap
            entries={entries}
            activeEntryId={activeEntry?.id ?? FIRST_ENTRY_ID}
            visitedEntryIds={visitedEntryIds}
            onSelectEntry={(entryId) => navigateToEntry(entryId, "map")}
          />

          <ArchiveIndex
            entries={entries}
            activeEntryId={activeEntry?.id ?? FIRST_ENTRY_ID}
            visitedEntryIds={visitedEntryIds}
            onSelectEntry={(entryId) => navigateToEntry(entryId, "read")}
          />
        </section>
      ) : null}

      {mode === "read" ? (
        <section className="reader-panel" aria-label="Focused reading mode">
          <div className="reader-panel-inner">
            <p className="reader-kicker">
              {activeEntry?.chapter} / {sceneLabel(activeEntry)} / {currentChapterProgress || 1} of {currentChapterEntries.length || 1}
            </p>
            <h1>{activeEntry?.title}</h1>
            <div className="reader-body">
              {paragraphs.map((paragraph, index) => (
                <p key={`${activeEntry?.id}-reader-${index}`}>{paragraph}</p>
              ))}
            </div>
            <div className="reader-footer">
              <button type="button" onClick={() => setMode("explore")}>Return to clearing</button>
              <button type="button" onClick={moveToPrevious} disabled={history.length === 0 && !adjacency?.previous}>Back</button>
              <button type="button" onClick={continueToNext} disabled={!nextEntry}>Next fragment</button>
              <button type="button" onClick={() => setMode("map")}>Open map</button>
            </div>
          </div>
        </section>
      ) : null}

      {mode === "explore" ? (
        <section className="portal-dock" aria-label="Available portals">
          <div className="portal-dock-header">
            <div>
              <p>Listening thresholds</p>
              <strong>{portalCards.length} ways the wood can turn</strong>
            </div>
            <span>{activeVisual?.orientation ?? "procedural"} visual</span>
          </div>

          <div className="portal-dock-list">
            {portalCards.map(({ portal, target, shortcut, isVisited }) => (
              <button
                key={portal.id}
                type="button"
                className={`portal-dock-card is-${portal.kind}${isVisited ? " is-visited" : ""}`}
                onClick={() => portal.targetEntryId && navigateToEntry(portal.targetEntryId, "explore")}
                disabled={!portal.targetEntryId}
              >
                <span className="portal-dock-shortcut">{shortcut}</span>
                <span className="portal-dock-copy">
                  <small>{portalActionLabel(portal)}</small>
                  <strong>{portal.label}</strong>
                  <em>{portalDockLine(target, portal)}</em>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {mode === "explore" ? (
        <section className="chapter-path" aria-label="Current chapter path">
          <div className="chapter-path-header">
            <span>{activeEntry?.chapter ?? "Chapter"}</span>
            <strong>{currentChapterProgress}/{currentChapterEntries.length}</strong>
          </div>
          <div className="chapter-path-nodes">
            {currentChapterEntries.map((entry, index) => {
              const isActive = entry.id === activeEntry?.id;
              const isVisited = visitedSet.has(entry.id);
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`${isActive ? "is-active" : ""}${isVisited ? " is-visited" : ""}`}
                  onClick={() => navigateToEntry(entry.id, "explore")}
                  aria-label={`Open ${entry.title}`}
                  title={`${index + 1}. ${entry.title}`}
                >
                  {index + 1}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {mode === "explore" ? (
        <section className="chapter-progress" aria-label="Chapter progress">
          {chapterProgress.map((chapter) => {
            const percentage = chapter.total > 0 ? Math.round((chapter.visited / chapter.total) * 100) : 0;
            return (
              <div className="chapter-progress-row" key={chapter.chapter}>
                <span>{chapter.chapter}</span>
                <strong>{chapter.visited}/{chapter.total}</strong>
                <i style={{ width: `${percentage}%` }} />
              </div>
            );
          })}
        </section>
      ) : null}

      {mode === "explore" ? (
        <section className="scene-compass" aria-label="Scene compass">
          <span>{sceneLabel(activeEntry)}</span>
          <strong>{controls === "walk" ? "walk mode" : controls === "orbit" ? "drag to look" : "focus locked"}</strong>
          <em>{controls === "walk" ? "click the wood, then walk until a threshold opens" : "drag the clearing, or choose a threshold below"}</em>
        </section>
      ) : null}

      {hasDiagnosticsWarning ? (
        <section className="content-diagnostics" aria-label="Content diagnostics">
          <strong>Content check</strong>
          {contentDiagnostics.entriesMissingParagraphs.length > 0 ? (
            <span>{contentDiagnostics.entriesMissingParagraphs.length} entries need paragraphs</span>
          ) : null}
          {contentDiagnostics.duplicateEntryIds.length > 0 ? (
            <span>{contentDiagnostics.duplicateEntryIds.length} duplicate entry IDs</span>
          ) : null}
          {contentDiagnostics.duplicateVisualIds.length > 0 ? (
            <span>{contentDiagnostics.duplicateVisualIds.length} duplicate visual IDs</span>
          ) : null}
        </section>
      ) : null}

      <div className="story-instructions" aria-hidden="true">
        {mode === "explore"
          ? controls === "walk"
            ? `Click the scene to give the wood your gaze. WASD / arrows move. Walk into a bright threshold. F/Enter reads. ${visitedCount}/${totalCount} remembered.`
            : `Use threshold cards, glowing paths, or 1–4. F/Enter reads. M opens the constellation. ${visitedCount}/${totalCount} remembered.`
          : mode === "read"
            ? "Focused reading mode. Esc returns to the clearing. M opens the constellation."
            : "Constellation mode. Select a remembered node. Esc returns to the clearing."}
      </div>

      <div className={`scene-transition${transitioning ? " is-active" : ""}`} aria-hidden="true">
        <span>{transitioning ? "the wood turns" : ""}</span>
      </div>
    </main>
  );
}
