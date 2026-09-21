import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearJourneySessionToken,
  getJourneySessionToken,
  getSessionSubject,
  loadCloudJourney,
  saveCloudJourney,
  verifyMagicLink,
} from "../lib/cloudJourneyClient";
import { JourneyHttpError } from "../lib/journeyTransport";
import { useJourneyStore, type CloudJourneySnapshot } from "../stores/useJourneyStore";

const SAVE_DEBOUNCE_MS = 1_500;

function clearMagicLinkTokenFromUrl() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has("sidtw_token")) return;
  params.delete("sidtw_token");
  const query = params.toString();
  const nextUrl = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function isNewer(remote: CloudJourneySnapshot, local: CloudJourneySnapshot) {
  const remoteTime = Date.parse(remote.updatedAt || "");
  const localTime = Date.parse(local.updatedAt || "");
  if (Number.isNaN(remoteTime)) return false;
  if (Number.isNaN(localTime)) return true;
  return remoteTime > localTime;
}

export function useCloudJourneySync() {
  const isInitialized = useJourneyStore((state) => state.isInitialized);
  const updatedAt = useJourneyStore((state) => state.updatedAt);
  const hydrateJourney = useJourneyStore((state) => state.hydrateJourney);
  const setCloudState = useJourneyStore((state) => state.setCloudState);
  const getSnapshot = useJourneyStore((state) => state.getSnapshot);

  const snapshot = useMemo<CloudJourneySnapshot>(
    () => getSnapshot(),
    [getSnapshot, updatedAt],
  );

  const bootstrappedRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const suppressNextSaveRef = useRef(false);
  const lastSavedSignatureRef = useRef("");
  const [bootstrapReady, setBootstrapReady] = useState(false);
  const [retryRevision, setRetryRevision] = useState(0);

  useEffect(() => {
    const retry = () => setRetryRevision(value => value + 1);
    window.addEventListener("online", retry);
    return () => window.removeEventListener("online", retry);
  }, []);

  useEffect(() => {
    if (!isInitialized || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    let cancelled = false;

    const bootstrapCloudSync = async () => {
      const params = new URLSearchParams(window.location.search);
      const magicToken = params.get("sidtw_token");
      const existingToken = getJourneySessionToken();

      if (!magicToken && !existingToken) {
        setCloudState({ cloudStatus: "signed-out", cloudSubject: null, cloudMessage: "Cloud save is available after magic-link restore." });
        cloudReadyRef.current = true;
        if (!cancelled) setBootstrapReady(true);
        return;
      }

      setCloudState({ cloudStatus: "loading", cloudMessage: magicToken ? "Restoring your forest from the magic link…" : "Loading your saved forest…" });

      try {
        if (magicToken) {
          const payload = await verifyMagicLink(magicToken);
          clearMagicLinkTokenFromUrl();
          if (cancelled) return;

          const subject = getSessionSubject(payload.sessionToken);
          if (payload.journey) {
            suppressNextSaveRef.current = true;
            hydrateJourney(payload.journey, { source: "cloud" });
          }

          setCloudState({
            cloudStatus: "synced",
            cloudSubject: subject,
            cloudLoadedAt: new Date().toISOString(),
            cloudMessage: payload.journey ? "Cloud journey restored." : "Magic link verified. This journey will now save to Cloudflare.",
          });
          cloudReadyRef.current = true;
          setBootstrapReady(true);
          return;
        }

        const subject = getSessionSubject(existingToken);
        const payload = await loadCloudJourney();
        if (cancelled) return;

        const localSnapshot = getSnapshot();
        if (payload?.journey && isNewer(payload.journey, localSnapshot)) {
          suppressNextSaveRef.current = true;
          hydrateJourney(payload.journey, { source: "cloud" });
        }

        setCloudState({
          cloudStatus: "synced",
          cloudSubject: subject,
          cloudLoadedAt: new Date().toISOString(),
          cloudMessage: payload?.journey ? "Cloud journey is connected." : "Cloud save connected. Your first journey state will be saved shortly.",
        });
        cloudReadyRef.current = true;
        setBootstrapReady(true);
      } catch (error) {
        clearMagicLinkTokenFromUrl();
        const message = error instanceof Error ? error.message : "Cloud journey sync failed.";
        if (error instanceof JourneyHttpError && error.status === 401) clearJourneySessionToken();
        if (!cancelled) {
          setCloudState({ cloudStatus: "error", cloudSubject: null, cloudMessage: message });
          cloudReadyRef.current = true;
          setBootstrapReady(true);
        }
      }
    };

    void bootstrapCloudSync();

    return () => {
      cancelled = true;
    };
  }, [getSnapshot, hydrateJourney, isInitialized, setCloudState]);

  useEffect(() => {
    if (!isInitialized || !bootstrapReady || !bootstrappedRef.current || !cloudReadyRef.current || !getJourneySessionToken()) return;

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      lastSavedSignatureRef.current = JSON.stringify(snapshot);
      return;
    }

    const signature = JSON.stringify(snapshot);
    if (signature === lastSavedSignatureRef.current) return;

    const token = getJourneySessionToken();
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      if (!token || getJourneySessionToken() !== token) return;
      setCloudState({ cloudStatus: "saving", cloudMessage: "Saving your forest to Cloudflare…" });
      saveCloudJourney(snapshot, token)
        .then((payload) => {
          if (cancelled || !payload.ok || getJourneySessionToken() !== token) return;
          lastSavedSignatureRef.current = signature;
          if (JSON.stringify(getSnapshot()) !== signature) return;
          setCloudState({
            cloudStatus: "synced",
            cloudSavedAt: new Date().toISOString(),
            cloudMessage: "Cloud journey saved.",
          });
        })
        .catch((error) => {
          if (cancelled || getJourneySessionToken() !== token) return;
          const message = error instanceof Error ? error.message : "Could not save journey to Cloudflare.";
          if (error instanceof JourneyHttpError && error.status === 401) clearJourneySessionToken();
          setCloudState({ cloudStatus: "error", cloudMessage: message });
        });
    }, SAVE_DEBOUNCE_MS);

    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [bootstrapReady, getSnapshot, isInitialized, retryRevision, setCloudState, snapshot]);

  return { bootstrapReady } as const;
}
