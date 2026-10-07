import { useLayoutEffect, useRef } from "react";

/** Runs in the actual Html DOM root, after its requested guidance exists. */
export function OpeningGuidance({ line, hint, detailed, stage, focusRequested }: {
  line: string | null; hint: string; detailed: boolean; stage: number; focusRequested: boolean;
}) {
  const ref = useRef<HTMLParagraphElement>(null);
  useLayoutEffect(() => {
    if (focusRequested) ref.current?.focus({ preventScroll: true });
  }, [focusRequested]);
  return <p ref={ref} className="story-object-onboarding" tabIndex={-1}
    data-quiet-guidance={detailed ? "details" : "line"} data-opening-guidance-stage={stage}>
    {line}{detailed ? <span>{hint}</span> : null}
  </p>;
}
