import { useEffect, useMemo } from "react";
import { entries, visuals } from "./data/slipperContent";
import type { SceneProximityState } from "./components/three/StoryScene";
import { WorldCanvas } from "./components/three/WorldCanvas";
import { useJourneyStore } from "./stores/useJourneyStore";
import { useWorldStore } from "./stores/useWorldStore";

const FIRST_ENTRY_ID = entries[0]?.id ?? "";

function narrativeWorldStateFor(visitedEntryIds: string[]) {
  const visited = entries.filter((entry) => visitedEntryIds.includes(entry.id));
  const text = visited.map((entry) => `${entry.title} ${entry.chapter} ${entry.tags.join(" ")} ${entry.body}`).join(" ").toLowerCase();

  const count = (pattern: RegExp) => (text.match(pattern) ?? []).length;
  const fireCount = count(/fire|ember|ash|burn|flame/g);
  const waterCount = count(/water|river|mirror|pool|rain/g);
  const memoryCount = count(/memory|remember|trace|archive|ghost/g);
  const crownCount = count(/crown|return|king|queen/g);

  return {
    visitedCount: Math.max(1, visitedEntryIds.length),
    totalCount: entries.length,
    traceCount: memoryCount,
    fireCount,
    waterCount,
    memoryCount,
    thresholdCount: count(/door|threshold|gate|cross/g),
    crownCount,
    fireWaterBalance: Math.max(-1, Math.min(1, (fireCount - waterCount) / Math.max(1, fireCount + waterCount))),
    explorationDepth: Math.max(0, Math.min(1, visitedEntryIds.length / Math.max(1, entries.length))),
    memoryPressure: Math.max(0, Math.min(1, memoryCount / 32)),
    symbolicWeight: Math.max(0, Math.min(1, (memoryCount + crownCount * 2) / 40)),
  };
}

export default function App() {
  const activeEntryId = useJourneyStore((state) => state.activeEntryId);
  const visitedEntryIds = useJourneyStore((state) => state.visitedEntryIds);
  const setActiveEntry = useJourneyStore((state) => state.setActiveEntry);
  const resetJourney = useJourneyStore((state) => state.resetJourney);
  const setPlayerPosition = useWorldStore((state) => state.setPlayerPosition);
  const setProximity = useWorldStore((state) => state.setProximity);

  useEffect(() => {
    if (!activeEntryId && FIRST_ENTRY_ID) resetJourney(FIRST_ENTRY_ID);
  }, [activeEntryId, resetJourney]);

  const narrativeWorldState = useMemo(() => narrativeWorldStateFor(visitedEntryIds), [visitedEntryIds]);

  const handleProximityChange = (state: SceneProximityState) => {
    setPlayerPosition(state.playerPosition);
    setProximity({
      nearestEntryId: state.nearestEntryId,
      nearestDistance: state.distance,
      proximityPresence: state.uiPresence,
    });
  };

  return (
    <WorldCanvas
      entryId={activeEntryId || FIRST_ENTRY_ID}
      entries={entries}
      visuals={visuals}
      controls="walk"
      mode="explore"
      visitedEntryIds={visitedEntryIds}
      narrativeWorldState={narrativeWorldState}
      onPortalSelect={setActiveEntry}
      onPlayerProximityChange={handleProximityChange}
    />
  );
}
