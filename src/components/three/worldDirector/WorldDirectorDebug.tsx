import { Html } from "@react-three/drei";
import { useMemo } from "react";
import type { NarrativeWorldState } from "../StoryScene";
import type { RenderQualityProfile } from "../renderQuality";
import type { WorldDirectorState } from "./worldDirector";

type WorldDirectorDebugProps = {
  worldDirector: WorldDirectorState;
  qualityProfile: RenderQualityProfile;
  narrativeWorldState: NarrativeWorldState;
  enabled?: boolean;
};

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatNumber(value: number, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "0.00";
}

export function WorldDirectorDebug({
  worldDirector,
  qualityProfile,
  narrativeWorldState,
  enabled = false,
}: WorldDirectorDebugProps) {
  const rows = useMemo(
    () => [
      ["quality", qualityProfile.quality],
      ["lantern reach", formatNumber(worldDirector.lantern.reach, 1)],
      ["lantern steadiness", formatPercent(worldDirector.lantern.steadiness)],
      ["lantern shadows", worldDirector.lantern.shadows ? "on" : "off"],
      ["fog density", formatNumber(worldDirector.environment.fogDensity, 3)],
      ["path clarity", formatPercent(worldDirector.environment.pathClarity)],
      ["semantic density", formatPercent(worldDirector.environment.semanticDensity)],
      ["weather", formatPercent(worldDirector.environment.weatherIntensity)],
      ["memory pressure", formatPercent(narrativeWorldState.memoryPressure)],
      ["exploration depth", formatPercent(narrativeWorldState.explorationDepth)],
      ["fire/water", formatNumber(narrativeWorldState.fireWaterBalance, 2)],
    ],
    [qualityProfile.quality, worldDirector, narrativeWorldState],
  );

  if (!enabled) return null;

  return (
    <Html fullscreen prepend zIndexRange={[100, 0]}>
      <aside
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          width: 260,
          padding: "12px 14px",
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.14)",
          background: "rgba(5, 6, 7, 0.74)",
          backdropFilter: "blur(18px)",
          color: "rgba(255,245,218,0.92)",
          fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
          fontSize: 11,
          lineHeight: 1.45,
          pointerEvents: "none",
          boxShadow: "0 18px 50px rgba(0,0,0,0.32)",
        }}
      >
        <div style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.14em", opacity: 0.68 }}>
          4D World Director
        </div>
        <div style={{ display: "grid", gap: 4 }}>
          {rows.map(([label, value]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ opacity: 0.58 }}>{label}</span>
              <strong style={{ fontWeight: 600 }}>{value}</strong>
            </div>
          ))}
        </div>
      </aside>
    </Html>
  );
}

export default WorldDirectorDebug;
