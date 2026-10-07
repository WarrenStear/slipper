import { lazy, Suspense, type RefObject } from "react";
import type { Slipper3DEntry } from "../../data/slipper3dTypes";
import type { SceneProximityState } from "../../components/three/StoryScene";
import type { SlipperExperienceCapabilities } from "../../lib/experienceMode";
import ArchiveIndex, { MapWorkspaceTabs, STORY_MAP_ARCHIVE_PANEL_ID, STORY_MAP_ARCHIVE_TAB_ID,
  STORY_MAP_CONSTELLATION_PANEL_ID, STORY_MAP_CONSTELLATION_TAB_ID,
  type StoryMapPane } from "../../components/ui/ArchiveIndex";

const ConstellationMap = lazy(() => import("../../components/ui/ConstellationMap"));

export type MapWorkspaceProps = {
  capabilities: SlipperExperienceCapabilities;
  entries: Slipper3DEntry[];
  activeEntryId: string;
  visitedEntryIds: string[];
  sceneProximity: SceneProximityState | null;
  mobile: boolean;
  activePane: StoryMapPane;
  onChangePane: (pane: StoryMapPane) => void;
  workspaceRef: RefObject<HTMLElement>;
  onReturnToForest: () => void;
  onOpenEntry: (entryId: string) => void;
  onGuideEntry: (entryId: string) => boolean | void;
};

/** The shell owns view changes; this owner composes lazy map panels and their accessible tab relations. */
export function MapWorkspace({ capabilities, entries, activeEntryId, visitedEntryIds, sceneProximity,
  mobile, activePane, onChangePane, workspaceRef, onReturnToForest, onOpenEntry, onGuideEntry }: MapWorkspaceProps) {
  if (!capabilities.allowConstellationView) return null;
  const tabs = mobile && capabilities.allowFullArchive;
  return <section ref={workspaceRef} tabIndex={-1}
    className={`map-workspace${capabilities.constellationScope === "witnessed-only" ? " is-partial-constellation" : ""}`}
    aria-label="Story map workspace" data-constellation-scope={capabilities.constellationScope}>
    <button className="memory-return" type="button" onClick={onReturnToForest}>Return to forest</button>
    {tabs ? <MapWorkspaceTabs activePane={activePane} onChange={onChangePane} /> : null}
    <Suspense fallback={<div className="forest-loader" role="status">Charting the remembered clearings…</div>}>
      <ConstellationMap scope={capabilities.constellationScope} entries={entries} activeEntryId={activeEntryId}
        visitedEntryIds={visitedEntryIds} sceneProximity={sceneProximity}
        onOpenEntry={capabilities.allowConstellationNavigation ? onOpenEntry : undefined}
        onGuideEntry={capabilities.allowConstellationNavigation ? onGuideEntry : undefined}
        panelId={tabs ? STORY_MAP_CONSTELLATION_PANEL_ID : undefined}
        labelledBy={tabs ? STORY_MAP_CONSTELLATION_TAB_ID : undefined}
        hidden={tabs && activePane !== "constellation"} />
    </Suspense>
    {capabilities.allowFullArchive ? <ArchiveIndex entries={entries} activeEntryId={activeEntryId}
      visitedEntryIds={visitedEntryIds} onOpenEntry={onOpenEntry} onGuideEntry={onGuideEntry}
      panelId={mobile ? STORY_MAP_ARCHIVE_PANEL_ID : undefined}
      labelledBy={mobile ? STORY_MAP_ARCHIVE_TAB_ID : undefined}
      hidden={mobile && activePane !== "archive"} /> : null}
  </section>;
}
