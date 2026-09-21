import { useEffect, useRef, useState } from "react";

/** Observe the caption itself, not the whole page or a potentially tall guide. */
export function useStoryCaptionVisibility(enabled: boolean, scopeKey: string) {
  const captionRef = useRef<HTMLParagraphElement>(null);
  const [visibility, setVisibility] = useState({ scopeKey, inView: false });

  useEffect(() => {
    setVisibility({ scopeKey, inView: false });
    const caption = captionRef.current;
    if (!enabled || !caption) return;
    // Older renderers retain the explicit hold control rather than deadlocking.
    if (typeof IntersectionObserver === "undefined") {
      setVisibility({ scopeKey, inView: true });
      return;
    }
    let disposed = false;
    const observer = new IntersectionObserver(entries => {
      if (disposed) return;
      const entry = entries.find(item => item.target === caption);
      if (!entry) return;
      const inView = entry.isIntersecting && entry.intersectionRatio >= 0.5;
      setVisibility(previous => previous.scopeKey === scopeKey && previous.inView === inView
        ? previous : { scopeKey, inView });
    }, { threshold: [0, 0.5, 1] });
    observer.observe(caption);
    return () => { disposed = true; observer.disconnect(); };
  }, [enabled, scopeKey]);

  return { captionRef, inView: enabled && visibility.scopeKey === scopeKey && visibility.inView };
}
