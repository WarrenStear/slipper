export const GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY =
  "sidtw:gift-dedication-acknowledgement:v1";
export const GIFT_DEDICATION_ACKNOWLEDGEMENT_EVENT =
  "sidtw:gift-dedication-acknowledgement-change";

const ACKNOWLEDGEMENT_SCHEMA_VERSION = 1;

export type DedicationPresentationStorage = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

type DedicationAcknowledgementRecord = Readonly<{
  version: typeof ACKNOWLEDGEMENT_SCHEMA_VERSION;
  acknowledged: true;
}>;

function browserStorage(): DedicationPresentationStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function resolveStorage(
  storage: DedicationPresentationStorage | null | undefined,
) {
  return storage === undefined ? browserStorage() : storage;
}

function parseAcknowledgement(raw: string | null) {
  if (!raw) return false;
  try {
    const value = JSON.parse(raw) as Partial<DedicationAcknowledgementRecord>;
    return (
      value.version === ACKNOWLEDGEMENT_SCHEMA_VERSION &&
      value.acknowledged === true
    );
  } catch {
    return false;
  }
}

function announceAcknowledgement(acknowledged: boolean) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(GIFT_DEDICATION_ACKNOWLEDGEMENT_EVENT, {
      detail: { acknowledged },
    }),
  );
}

/**
 * This preference is deliberately separate from StoryJourneyState: it records
 * only whether the post-story presentation has been acknowledged and cannot
 * advance, complete, or otherwise mutate the canonical narrative.
 */
export function getGiftDedicationAcknowledged(
  storage?: DedicationPresentationStorage | null,
) {
  const target = resolveStorage(storage);
  if (!target) return false;
  try {
    return parseAcknowledgement(
      target.getItem(GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY),
    );
  } catch {
    return false;
  }
}

export function setGiftDedicationAcknowledged(
  acknowledged = true,
  storage?: DedicationPresentationStorage | null,
) {
  const target = resolveStorage(storage);
  if (!target) return false;

  try {
    if (acknowledged) {
      const record: DedicationAcknowledgementRecord = {
        version: ACKNOWLEDGEMENT_SCHEMA_VERSION,
        acknowledged: true,
      };
      target.setItem(
        GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY,
        JSON.stringify(record),
      );
    } else {
      target.removeItem(GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY);
    }
    announceAcknowledgement(acknowledged);
    return true;
  } catch {
    return false;
  }
}

export function clearGiftDedicationAcknowledgement(
  storage?: DedicationPresentationStorage | null,
) {
  return setGiftDedicationAcknowledged(false, storage);
}

export function subscribeGiftDedicationAcknowledgement(
  listener: (acknowledged: boolean) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = () => listener(getGiftDedicationAcknowledged());
  const handleStorage = (event: StorageEvent) => {
    if (event.key === GIFT_DEDICATION_ACKNOWLEDGEMENT_STORAGE_KEY) {
      handleChange();
    }
  };

  window.addEventListener(GIFT_DEDICATION_ACKNOWLEDGEMENT_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(
      GIFT_DEDICATION_ACKNOWLEDGEMENT_EVENT,
      handleChange,
    );
    window.removeEventListener("storage", handleStorage);
  };
}
