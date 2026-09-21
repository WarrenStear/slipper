const STORAGE_KEY = "slipper-3d-journey-v1";

export type StoredJourney = {
  activeEntryId: string;
  history: string[];
  visitedEntryIds: string[];
};

function isStoredJourney(value: unknown): value is StoredJourney {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<StoredJourney>;

  return (
    typeof candidate.activeEntryId === "string" &&
    Array.isArray(candidate.history) &&
    Array.isArray(candidate.visitedEntryIds) &&
    candidate.history.every((item) => typeof item === "string") &&
    candidate.visitedEntryIds.every((item) => typeof item === "string")
  );
}

export function loadStoredJourney(validEntryIds: string[], fallbackEntryId: string): StoredJourney | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as unknown;
    if (!isStoredJourney(parsed)) return null;

    const activeEntryId = validEntryIds.includes(parsed.activeEntryId)
      ? parsed.activeEntryId
      : fallbackEntryId;

    const history = parsed.history.filter((entryId) => validEntryIds.includes(entryId));
    const visitedEntryIds = Array.from(
      new Set([
        ...(fallbackEntryId ? [fallbackEntryId] : []),
        ...parsed.visitedEntryIds.filter((entryId) => validEntryIds.includes(entryId)),
        ...(activeEntryId ? [activeEntryId] : []),
      ]),
    );

    return {
      activeEntryId,
      history,
      visitedEntryIds,
    };
  } catch {
    return null;
  }
}

export function saveStoredJourney(journey: StoredJourney) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(journey));
  } catch {
    // Ignore storage write failures. The story engine still works without persistence.
  }
}

export function clearStoredJourney() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}
