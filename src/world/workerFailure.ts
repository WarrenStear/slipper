import { createContext, useCallback, useContext, useLayoutEffect, useRef, type ReactNode } from "react";

type WorkerFailureReporter = (error: Error) => void;

/** The DOM canvas owner receives failures even while its scene is suspended. */
export const WorldWorkerFailureContext = createContext<WorkerFailureReporter | null>(null);

export function WorldWorkerFailureGuard({ error, children }: { error: Error | null; children: ReactNode }) {
  if (error) throw error;
  return children;
}

/** Stable for the worker's lifetime, with the current canvas callback. Direct
 * source fixtures have no provider and retain their local render-time throw. */
export function useReportWorldWorkerFailure(): WorkerFailureReporter {
  const reporter = useContext(WorldWorkerFailureContext);
  const reporterRef = useRef(reporter);
  useLayoutEffect(() => { reporterRef.current = reporter; }, [reporter]);
  return useCallback((error: Error) => { reporterRef.current?.(error); }, []);
}

/** A queued event from a terminated worker cannot fail a newer canvas scene. */
export function reportCurrentWorldWorkerFailure(
  worker: object,
  currentWorker: object | null,
  error: Error,
  setLocalError: WorkerFailureReporter,
  reportCanvasError: WorkerFailureReporter,
) {
  if (worker !== currentWorker) return false;
  setLocalError(error);
  reportCanvasError(error);
  return true;
}
