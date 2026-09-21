import { create } from "zustand";

export type PlayerLookDelta = {
  x: number;
  y: number;
};

type PlayerInputStore = {
  moveX: number;
  moveZ: number;
  lookX: number;
  lookY: number;
  setMovement: (moveX: number, moveZ: number) => void;
  addLookDelta: (lookX: number, lookY: number) => void;
  consumeLookDelta: (target: PlayerLookDelta) => PlayerLookDelta;
  reset: () => void;
};

function finiteOrZero(value: number) {
  return Number.isFinite(value) ? value : 0;
}

function clampAxis(value: number) {
  return Math.max(-1, Math.min(1, finiteOrZero(value)));
}

function clampLook(value: number) {
  return Math.max(-180, Math.min(180, finiteOrZero(value)));
}

export const usePlayerInputStore = create<PlayerInputStore>((set, get) => ({
  moveX: 0,
  moveZ: 0,
  lookX: 0,
  lookY: 0,
  setMovement: (moveX, moveZ) => {
    const x = clampAxis(moveX);
    const z = clampAxis(moveZ);
    const magnitude = Math.hypot(x, z);
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    set({ moveX: x * scale, moveZ: z * scale });
  },
  addLookDelta: (lookX, lookY) =>
    set((state) => ({
      lookX: clampLook(state.lookX + finiteOrZero(lookX)),
      lookY: clampLook(state.lookY + finiteOrZero(lookY)),
    })),
  consumeLookDelta: (target) => {
    const { lookX, lookY } = get();
    if (lookX !== 0 || lookY !== 0) set({ lookX: 0, lookY: 0 });
    target.x = lookX;
    target.y = lookY;
    return target;
  },
  reset: () => set({ moveX: 0, moveZ: 0, lookX: 0, lookY: 0 }),
}));

export function resetPlayerInput() {
  usePlayerInputStore.getState().reset();
}
