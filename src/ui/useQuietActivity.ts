import { useCallback, useEffect, useRef, useState } from 'react';
import { connectQuietActivity, createQuietActivityClock } from './quietActivity';

/** Replaces the shell's existing one-second idle interval; this cannot progress a story. */
export function useQuietActivity(participating: boolean, overlayOpen: boolean) {
  const [idleMs, setIdleMs] = useState(0);
  const context = useRef({ participating, overlayOpen }); context.current = { participating, overlayOpen };
  const clock = useRef<ReturnType<typeof createQuietActivityClock> | null>(null);
  if (!clock.current) clock.current = createQuietActivityClock(typeof performance === 'undefined' ? 0 : performance.now());
  const bridge = useRef<ReturnType<typeof connectQuietActivity> | null>(null);
  const reset = useCallback(() => { clock.current?.activity(performance.now()); setIdleMs(0); }, []);
  useEffect(() => {
    const connection = connectQuietActivity({ clock: clock.current!, window, document, now: () => performance.now(),
      getContext: () => ({ ...context.current, foreground: !document.hidden && document.hasFocus() }), onReset: () => setIdleMs(0) });
    bridge.current = connection;
    const interval = window.setInterval(() => { connection.refresh(); setIdleMs(clock.current!.sample(performance.now())); }, 1_000);
    return () => { window.clearInterval(interval); connection.dispose(); if (bridge.current === connection) bridge.current = null; };
  }, []);
  useEffect(() => { bridge.current?.refresh(); reset(); }, [participating, overlayOpen, reset]);
  return { idleMs, noteActivity: reset };
}
