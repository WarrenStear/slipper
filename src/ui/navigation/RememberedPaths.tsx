import type { CSSProperties } from "react";
import type { Slipper3DEntry, Vector3Tuple } from "../../data/slipper3dTypes";
import type { SceneProximityState, StorySceneControls } from "../../components/three/StoryScene";
import type { MobileControlMode, SettingsStore } from "../../stores/useSettingsStore";
import { canReadStoryEntry } from "../../narrative/StorySelectors";
import { rotateXZByYaw, trailStateLabel } from "../../lib/navigationPresentation";
import { MagicLinkSignIn } from "../../components/auth/MagicLinkSignIn";

function shortTitle(title?: string, limit = 28) {
  if (!title) return "Unknown";
  return title.length > limit ? `${title.slice(0, limit - 1)}…` : title;
}

function sceneLabel(entry?: Slipper3DEntry) {
  if (!entry) return "Unknown clearing";
  return entry.engine3d.sceneKind ?? entry.engine3d.mood ?? "fragment";
}

function rememberedRouteTitle(entries: Slipper3DEntry[], witnessedEntryIds: readonly string[], entryId?: string | null,
  fallback = "The next clearing") {
  if (!entryId) return fallback;
  if (!witnessedEntryIds.includes(entryId)) return "Unread memory";
  return entries.find(entry => entry.id === entryId)?.title ?? "A remembered clearing";
}

const MINI_MAP_SIZE = 172;
const MINI_MAP_CENTER = MINI_MAP_SIZE / 2;
const MINI_MAP_RADIUS = 62;
const MINI_MAP_WORLD_RADIUS = 32;

function minimapVector(from?: Vector3Tuple | null, to?: Vector3Tuple | null, cameraYaw = 0) {
  if (!from || !to) return { x: MINI_MAP_CENTER, y: MINI_MAP_CENTER, distance: 0, hasTarget: false };

  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const distance = Math.sqrt(dx * dx + dz * dz);
  const scale = distance > MINI_MAP_WORLD_RADIUS ? MINI_MAP_WORLD_RADIUS / Math.max(distance, 0.0001) : 1;
  const rotated = rotateXZByYaw(dx, dz, cameraYaw);

  return {
    x: MINI_MAP_CENTER + (rotated.x / MINI_MAP_WORLD_RADIUS) * MINI_MAP_RADIUS * scale,
    y: MINI_MAP_CENTER - (rotated.z / MINI_MAP_WORLD_RADIUS) * MINI_MAP_RADIUS * scale,
    distance,
    hasTarget: true,
  };
}

function miniMapShellStyle(): CSSProperties {
  return {
    position: "absolute",
    right: 22,
    bottom: 126,
    zIndex: 22,
    width: 218,
    padding: "14px 14px 12px",
    borderRadius: 22,
    border: "1px solid rgba(255,245,206,0.18)",
    background: "linear-gradient(180deg, rgba(9,10,12,0.78), rgba(5,6,8,0.58))",
    boxShadow: "0 22px 70px rgba(0,0,0,0.38)",
    backdropFilter: "blur(18px)",
    WebkitBackdropFilter: "blur(18px)",
    color: "#f6efe2",
    pointerEvents: "none",
  };
}

function MiniMapHUD({
  entries,
  activeEntryId,
  sceneProximity,
  witnessedEntryIds,
}: {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  witnessedEntryIds: string[];
  sceneProximity: SceneProximityState | null;
}) {
  const activeEntry = witnessedEntryIds.includes(activeEntryId) ? entries.find((entry) => entry.id === activeEntryId) : undefined;
  const titleEntryId = sceneProximity?.navigationTargetId ?? sceneProximity?.approachingEntryId ?? sceneProximity?.nearestEntryId;
  const targetTitle = rememberedRouteTitle(entries, witnessedEntryIds, titleEntryId, "Listening for a clearing");
  const playerPosition = sceneProximity?.playerPosition ?? sceneProximity?.activeWorldPosition ?? ([0, 0, 0] as Vector3Tuple);
  const targetPosition = sceneProximity?.navigationTargetWorldPosition ?? sceneProximity?.approachingWorldPosition ?? sceneProximity?.nearestWorldPosition ?? null;
  const blip = minimapVector(playerPosition, targetPosition, sceneProximity?.cameraYaw ?? 0);
  const approachingDistance = sceneProximity?.navigationTargetDistance && sceneProximity.navigationTargetDistance < 999 ? sceneProximity.navigationTargetDistance : sceneProximity?.approachingDistance && sceneProximity.approachingDistance < 999 ? sceneProximity.approachingDistance : blip.distance;
  const presence = Math.max(0.18, Math.min(1, sceneProximity?.uiPresence ?? 0.42));
  const sweepOpacity = 0.24 + presence * 0.44;
  const trailState = sceneProximity?.trailState ?? "on-trail";
  const trailLabel = trailStateLabel(trailState);

  return (
    <section className="mini-map-hud" style={miniMapShellStyle()} aria-label="Live mini-map">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
        <div>
          <p style={{ margin: 0, fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(246,239,226,0.58)" }}>live path</p>
          <strong style={{ display: "block", marginTop: 3, fontSize: 13, lineHeight: 1.2 }}>{shortTitle(activeEntry?.title, 24)}</strong>
        </div>
        <span style={{ fontSize: 11, color: "rgba(255,245,206,0.72)", border: "1px solid rgba(255,245,206,0.16)", borderRadius: 999, padding: "4px 7px" }}>
          {trailLabel}
        </span>
      </div>

      <svg width={MINI_MAP_SIZE} height={MINI_MAP_SIZE} viewBox={`0 0 ${MINI_MAP_SIZE} ${MINI_MAP_SIZE}`} role="img" aria-label="Player position and nearest clearing blip">
        <defs>
          <radialGradient id="mini-map-core" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#fff5ce" stopOpacity="0.34" />
            <stop offset="56%" stopColor="#d8d0ba" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#050608" stopOpacity="0" />
          </radialGradient>
          <filter id="mini-map-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={78} fill="url(#mini-map-core)" />
        <path d={`M ${MINI_MAP_CENTER - 8} ${MINI_MAP_CENTER - 60} L ${MINI_MAP_CENTER} ${MINI_MAP_CENTER - 75} L ${MINI_MAP_CENTER + 8} ${MINI_MAP_CENTER - 60} Z`} fill="rgba(255,245,206,0.2)" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={68} fill="none" stroke="rgba(255,245,206,0.16)" strokeWidth="1" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={43} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="1" strokeDasharray="3 6" />
        <path
          d={`M ${MINI_MAP_CENTER} ${MINI_MAP_CENTER} L ${MINI_MAP_CENTER + Math.cos(-Math.PI / 5) * 66} ${MINI_MAP_CENTER + Math.sin(-Math.PI / 5) * 66}`}
          stroke="rgba(255,245,206,0.12)"
          strokeWidth="1"
        />
        {blip.hasTarget ? (
          <>
            <line x1={MINI_MAP_CENTER} y1={MINI_MAP_CENTER} x2={blip.x} y2={blip.y} stroke="rgba(255,245,206,0.32)" strokeWidth="1.25" strokeDasharray="5 5" />
            <circle cx={blip.x} cy={blip.y} r={10 + presence * 4} fill="rgba(216,208,186,0.08)" stroke="rgba(255,245,206,0.24)" />
            <circle cx={blip.x} cy={blip.y} r={4.5} fill="#d8d0ba" filter="url(#mini-map-glow)" />
          </>
        ) : null}
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={14 + presence * 6} fill="rgba(255,245,206,0.08)" stroke={`rgba(255,245,206,${sweepOpacity})`} />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={5.5} fill="#fff5ce" filter="url(#mini-map-glow)" />
        <circle cx={MINI_MAP_CENTER} cy={MINI_MAP_CENTER} r={2} fill="#ffffff" />
      </svg>

      <div style={{ display: "grid", gap: 4, marginTop: 8 }}>
        <span style={{ fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: "rgba(246,239,226,0.46)" }}>guidance target</span>
        <strong style={{ fontSize: 12, lineHeight: 1.2 }}>{shortTitle(targetTitle, 31)}</strong>
        <em style={{ fontStyle: "normal", fontSize: 11, color: "rgba(246,239,226,0.56)" }}>
          {approachingDistance > 0 ? `${Math.max(1, Math.round(approachingDistance))} units / ${trailLabel}` : "standing in the active clearing"}
        </em>
      </div>
    </section>
  );
}

function ContextualNavigationPrompt({ sceneProximity, entries, witnessedEntryIds }: {
  sceneProximity: SceneProximityState | null; entries: Slipper3DEntry[]; witnessedEntryIds: readonly string[];
}) {
  const titleEntryId = sceneProximity?.navigationTargetId ?? sceneProximity?.approachingEntryId ?? sceneProximity?.nearestEntryId;
  const targetTitle = rememberedRouteTitle(entries, witnessedEntryIds, titleEntryId);
  const distance = sceneProximity?.navigationTargetDistance ?? sceneProximity?.approachingDistance ?? 0;
  const trailState = sceneProximity?.trailState ?? "on-trail";
  const label = trailStateLabel(trailState);
  const instruction =
    trailState === "lost"
      ? "Turn toward the bright mark and let the path reopen."
      : trailState === "edge-of-trail"
        ? "Ease back toward the centre of the trail."
        : sceneProximity?.insideClearing
          ? "This clearing is awake. Press F to read or follow the next signal."
          : "Walk forward when the blip sits above the centre mark.";

  return (
    <section className={`contextual-nav-prompt is-${trailState}`} aria-label="Current navigation guidance">
      <span>{label}</span>
      <strong>{shortTitle(targetTitle, 42)}</strong>
      <em>{distance > 0 && distance < 999 ? `${Math.max(1, Math.round(distance))} units away. ${instruction}` : instruction}</em>
    </section>
  );
}


export type RememberedChapterProgress = Readonly<{
  id: string; chapter: string; total: number; revealed: boolean; visited: number;
}>;
export type RememberedPathsProps = {
  entries: Slipper3DEntry[];
  activeEntryId: string;
  witnessedEntryIds: string[];
  sceneProximity: SceneProximityState | null;
  recentEntries: readonly Slipper3DEntry[];
  chapterEntries: readonly Slipper3DEntry[];
  chapterProgress: readonly RememberedChapterProgress[];
  counts: Readonly<{ visited: number; total: number; visuals: number; chapters: number }>;
  mobile: boolean;
  controls: StorySceneControls;
  showMiniMap: boolean;
  showCompass: boolean;
  showContextualGuidance: boolean;
  mobileControlMode: MobileControlMode;
  onSettingChange: SettingsStore["setSetting"];
  onOpenEntry: (entryId: string) => boolean;
  onGuideEntry: (entryId: string) => boolean;
  onDismiss: () => void;
};

/** Deliberate navigation disclosure only. It delegates commands and preferences to their existing owners. */
export function RememberedPaths({ entries, activeEntryId, witnessedEntryIds, sceneProximity,
  recentEntries, chapterEntries, chapterProgress, counts, mobile, controls, showMiniMap,
  showCompass, showContextualGuidance, mobileControlMode, onSettingChange,
  onOpenEntry, onGuideEntry, onDismiss }: RememberedPathsProps) {
  const readable = canReadStoryEntry(activeEntryId, { witnessedEntryIds });
  const activeEntry = readable ? entries.find(entry => entry.id === activeEntryId) : undefined;
  return <>
    <MagicLinkSignIn />
    <p>{counts.visited}/{counts.total} seen · {counts.visuals} visuals · {counts.chapters} chapters</p>
    <p>{mobile ? "Move with the analogue pad and drag Look to turn." : "WASD / arrows walk. F reads. M or I opens the constellation. B goes back."}</p>
    <label><input type="checkbox" checked={showMiniMap} onChange={event => onSettingChange("showMiniMap", event.target.checked)} /> Mini-map in navigation details</label>
    {showMiniMap && readable ? <div className="experience-menu__minimap"><MiniMapHUD entries={entries}
      activeEntryId={activeEntryId} sceneProximity={sceneProximity} witnessedEntryIds={witnessedEntryIds} /></div> : null}
    <label><input type="checkbox" checked={showCompass} onChange={event => onSettingChange("showCompass", event.target.checked)} /> Compass in navigation details</label>
    {showCompass ? <p>{controls === "walk" ? "Walk" : "Drag to look"} · {readable ? sceneLabel(activeEntry) : "A path still forming"}</p> : null}
    {showContextualGuidance ? <ContextualNavigationPrompt sceneProximity={sceneProximity} entries={entries} witnessedEntryIds={witnessedEntryIds} /> : null}
    <label><input type="radio" name="mobile-mode" checked={mobileControlMode === "direct"} onChange={() => onSettingChange("mobileControlMode", "direct")} /> Direct mobile controls</label>
    <label><input type="radio" name="mobile-mode" checked={mobileControlMode === "guided"} onChange={() => onSettingChange("mobileControlMode", "guided")} /> Guided mobile controls</label>
    <nav aria-label="Recent remembered trail">{recentEntries.filter(entry => witnessedEntryIds.includes(entry.id)).map(entry =>
      <button key={entry.id} type="button" onClick={() => { if (onOpenEntry(entry.id)) onDismiss(); }}>{entry.title}</button>)}</nav>
    <nav aria-label="Current chapter path">{chapterEntries.map((entry, index) =>
      <button key={entry.id} type="button" onClick={() => {
        const accepted = witnessedEntryIds.includes(entry.id) ? onOpenEntry(entry.id) : onGuideEntry(entry.id);
        if (accepted) onDismiss();
      }}>{witnessedEntryIds.includes(entry.id) ? entry.title : `Unread memory ${index + 1}`}</button>)}</nav>
    <div aria-label="Chapter progress">{chapterProgress.map(chapter =>
      <p key={chapter.id}>{chapter.revealed ? chapter.chapter : "A chapter still forming"} · {chapter.visited}/{chapter.total}</p>)}</div>
  </>;
}
