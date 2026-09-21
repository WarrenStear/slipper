import { create } from "zustand";
import type { Vector3Tuple } from "../data/slipper3dTypes";
import type { TrailState } from "../lib/navigationResolver";

export type BreadcrumbKind = "footprint" | "ember" | "puddle" | "ghost";

export type BreadcrumbTrace = {
  id: string;
  position: Vector3Tuple;
  yaw: number;
  kind: BreadcrumbKind;
  intensity: number;
  scale: number;
  createdAt: number;
  activeEntryId: string;
  trailState: TrailState;
};

type BreadcrumbDraft = Omit<BreadcrumbTrace, "id" | "createdAt"> & {
  id?: string;
  createdAt?: number;
};

type BreadcrumbStore = {
  traces: BreadcrumbTrace[];
  maxTraces: number;
  sequence: number;
  addBreadcrumb: (trace: BreadcrumbDraft, maxTraces?: number) => void;
  clearBreadcrumbs: () => void;
  pruneBreadcrumbs: (maxTraces?: number) => void;
};

const DEFAULT_MAX_TRACES = 420;

function createBreadcrumbId(sequence: number, activeEntryId: string) {
  return `crumb-${activeEntryId || "wood"}-${sequence.toString(36)}`;
}

export const useBreadcrumbStore = create<BreadcrumbStore>((set, get) => ({
  traces: [],
  maxTraces: DEFAULT_MAX_TRACES,
  sequence: 0,

  addBreadcrumb: (trace, maxTraces = get().maxTraces) => {
    const state = get();
    const sequence = state.sequence + 1;
    const nextTrace: BreadcrumbTrace = {
      ...trace,
      id: trace.id ?? createBreadcrumbId(sequence, trace.activeEntryId),
      createdAt: trace.createdAt ?? performance.now(),
    };
    const nextMax = Math.max(40, Math.min(760, maxTraces));
    const nextTraces = [...state.traces, nextTrace].slice(-nextMax);
    set({ traces: nextTraces, sequence, maxTraces: nextMax });
  },

  clearBreadcrumbs: () => set({ traces: [], sequence: 0 }),

  pruneBreadcrumbs: (maxTraces = get().maxTraces) => {
    const nextMax = Math.max(40, Math.min(760, maxTraces));
    set((state) => ({ traces: state.traces.slice(-nextMax), maxTraces: nextMax }));
  },
}));
