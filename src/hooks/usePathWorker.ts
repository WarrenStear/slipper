import { useEffect, useMemo, useRef, useState } from "react";
import type { Slipper3DEntry } from "../data/slipper3dTypes";
import type { PathWorkerRequest, PathWorkerResponse, SerializableMazePathSegment } from "../workers/pathWorker";

type UsePathWorkerOptions = {
  enabled?: boolean;
  onResult?: (segments: SerializableMazePathSegment[]) => void;
};

type PathWorkerState = {
  segments: SerializableMazePathSegment[];
  isLoading: boolean;
  error: string | null;
  durationMs: number | null;
};

const INITIAL_STATE: PathWorkerState = {
  segments: [],
  isLoading: false,
  error: null,
  durationMs: null,
};

export function usePathWorker(entries: Slipper3DEntry[], options: UsePathWorkerOptions = {}) {
  const { enabled = true, onResult } = options;
  const [state, setState] = useState<PathWorkerState>(INITIAL_STATE);
  const requestIdRef = useRef(0);

  const worker = useMemo(() => {
    if (!enabled || typeof Worker === "undefined") return null;
    return new Worker(new URL("../workers/pathWorker.ts", import.meta.url), { type: "module" });
  }, [enabled]);

  useEffect(() => {
    return () => worker?.terminate();
  }, [worker]);

  useEffect(() => {
    if (!enabled) {
      setState(INITIAL_STATE);
      return;
    }

    if (!worker) {
      setState((current) => ({
        ...current,
        isLoading: false,
        error: "Web Workers are not available in this browser.",
      }));
      return;
    }

    const requestId = `path-${Date.now()}-${requestIdRef.current++}`;

    const handleMessage = (event: MessageEvent<PathWorkerResponse>) => {
      const message = event.data;
      if (message.id !== requestId) return;

      if (message.type === "PATH_SEGMENTS_ERROR") {
        setState({ segments: [], isLoading: false, error: message.error, durationMs: null });
        return;
      }

      setState({
        segments: message.segments,
        isLoading: false,
        error: null,
        durationMs: message.durationMs,
      });
      onResult?.(message.segments);
    };

    worker.addEventListener("message", handleMessage);
    setState((current) => ({ ...current, isLoading: true, error: null }));

    const request: PathWorkerRequest = {
      id: requestId,
      type: "BUILD_PATH_SEGMENTS",
      entries,
    };
    worker.postMessage(request);

    return () => worker.removeEventListener("message", handleMessage);
  }, [enabled, entries, onResult, worker]);

  return state;
}

export type { SerializableMazePathSegment } from "../workers/pathWorker";
