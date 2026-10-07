import type { Slipper3DEntry, Vector3Tuple } from '../data/slipper3dTypes';
import { entryWorldPosition } from '../lib/worldLayout';

/** Exact authored target coordinates. Ownership/carrying remains in the wrapper. */
export function resolveLanternGuidanceTarget(entries: readonly Slipper3DEntry[], targetId?: string | null): Vector3Tuple | null {
  if (!targetId) return null;
  const target = entries.find(entry => entry.id === targetId);
  return target ? entryWorldPosition(target, [...entries]) : null;
}
