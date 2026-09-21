import { useEffect, useState } from "react";
import {
  getStoredRenderQuality,
  isRenderQuality,
  RENDER_QUALITY_EVENT,
  RENDER_QUALITY_PROFILES,
  resolveInitialRenderQuality,
  setPreferredRenderQuality,
  type RenderQuality,
} from "../../components/three/renderQuality";
import "./RenderQualitySelector.css";

const QUALITY_OPTIONS: RenderQuality[] = ["low", "medium", "high", "cinematic"];

function readQualityPreference() {
  return getStoredRenderQuality() ?? resolveInitialRenderQuality();
}

export function RenderQualitySelector() {
  const [quality, setQuality] = useState<RenderQuality>(() => readQualityPreference());

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncQuality = () => setQuality(readQualityPreference());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === "sidtw-render-quality") syncQuality();
    };
    const handleQualityEvent = (event: Event) => {
      const nextQuality = (event as CustomEvent<{ quality?: unknown }>).detail?.quality;
      if (typeof nextQuality === "string" && isRenderQuality(nextQuality)) setQuality(nextQuality);
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener(RENDER_QUALITY_EVENT, handleQualityEvent);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(RENDER_QUALITY_EVENT, handleQualityEvent);
    };
  }, []);

  return (
    <section className="render-quality-selector" aria-label="Render quality selector">
      <span>Quality</span>
      <div role="radiogroup" aria-label="Render quality">
        {QUALITY_OPTIONS.map((option) => {
          const profile = RENDER_QUALITY_PROFILES[option];
          const isActive = option === quality;

          return (
            <button
              key={option}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={isActive ? "is-active" : ""}
              onClick={() => {
                setQuality(option);
                setPreferredRenderQuality(option);
              }}
              title={`${profile.label}: DPR cap ${profile.pixelRatioCap}, forest radius ${profile.forestCellRadius}`}
            >
              {profile.label}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default RenderQualitySelector;
