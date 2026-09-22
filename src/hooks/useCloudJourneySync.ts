import { useEffect, useMemo, useRef, useState } from "react";
import {
  beginCloudJourneyRestore,
  clearJourneySessionToken,
  getJourneySessionToken,
  getSessionSubject,
  saveCloudJourney,
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
  const cloudSubject = useJourneyStore((state) => state.cloudSubject);
  const hydrateJourney = useJourneyStore((state) => state.hydrateJourney);
  const setCloudState = useJourneyStore((state) => state.setCloudState);
  const getSnapshot = useJourneyStore((state) => state.getSnapshot);

  const snapshot = useMemo<CloudJourneySnapshot>(
    () => getSnapshot(),
    [getSnapshot, updatedAt],
  );

  const bootstrappedRef = useRef(false);
  const cloudReadyRef = useRef(false);
  const connectedTokenRef = useRef<string | null>(null);
  const bootstrapRequestRef = useRef<ReturnType<typeof beginCloudJourneyRestore> | null>(null);
  const magicTokenRef = useRef<string | null | undefined>(undefined);
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
    if (!isInitialized || cloudReadyRef.current) return;
    bootstrappedRef.current = true;
    let cancelled = false;

    if (magicTokenRef.current === undefined) {
      magicTokenRef.current = new URLSearchParams(window.location.search).get("sidtw_token");
      // Keep retries in memory while removing the credential from history/referrers.
      clearMagicLinkTokenFromUrl();
    }
    // Effect replay must subscribe to the same request, especially for one-use links.
    const restore = bootstrapRequestRef.current ?? beginCloudJourneyRestore(magicTokenRef.current);
    bootstrapRequestRef.current = restore;

    if (!restore.magicToken && !restore.existingToken) {
      setCloudState({ cloudStatus: "signed-out", cloudSubject: null, cloudMessage: "Cloud save is available after magic-link restore." });
      cloudReadyRef.current = true;
      setBootstrapReady(true);
      return;
    }

    setCloudState({ cloudStatus: "loading", cloudMessage: restore.magicToken ? "Restoring your forest from the magic link…" : "Loading your saved forest…" });

    const bootstrapCloudSync = async () => {
      try {
        const payload = await restore.result;
        if (cancelled) return;
        if (!restore.accept(payload.sessionToken)) {
          bootstrapRequestRef.current = null;
          setBootstrapReady(true);
          return;
        }

        const localSnapshot = getSnapshot();
        if (payload.journey && (restore.magicToken || !useJourneyStore.getState().hasLocalJourney || isNewer(payload.journey, localSnapshot))) {
          suppressNextSaveRef.current = true;
          hydrateJourney(payload.journey, { source: "cloud" });
        }

        magicTokenRef.current = null;
        connectedTokenRef.current = payload.sessionToken;
        cloudReadyRef.current = true;
        setCloudState({
          cloudStatus: "synced",
          cloudSubject: getSessionSubject(payload.sessionToken),
          cloudLoadedAt: new Date().toISOString(),
          cloudMessage: payload.journey ? "Cloud journey is connected." : "Cloud save connected. Your first journey state will be saved shortly.",
        });
        setBootstrapReady(true);
      } catch (error) {
        if (cancelled) return;
        bootstrapRequestRef.current = null;
        if (!restore.isCurrent()) {
          setBootstrapReady(true);
          return;
        }
        const message = error instanceof Error ? error.message : "Cloud journey sync failed.";
        if (error instanceof JourneyHttpError && error.status === 401) {
          clearJourneySessionToken();
          magicTokenRef.current = null;
        }
        // Local play may continue, but never overwrite a cloud save we failed to read.
        // Reconnecting retries the restore before enabling any writes.
        cloudReadyRef.current = false;
        setCloudState({ cloudStatus: "error", cloudSubject: null, cloudMessage: message });
        setBootstrapReady(true);
      }
    };

    void bootstrapCloudSync();
    return () => { cancelled = true; };
  }, [getSnapshot, hydrateJourney, isInitialized, retryRevision, setCloudState]);

  useEffect(() => {
    if (!isInitialized || !bootstrapReady || !bootstrappedRef.current || !cloudReadyRef.current || !cloudSubject || !getJourneySessionToken()) return;

    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false;
      lastSavedSignatureRef.current = JSON.stringify(snapshot);
      return;
    }

    const signature = JSON.stringify(snapshot);
    if (signature === lastSavedSignatureRef.current) return;

    const token = getJourneySessionToken();
    if (token !== connectedTokenRef.current) return;
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
          const unauthorized = error instanceof JourneyHttpError && error.status === 401;
          if (unauthorized) clearJourneySessionToken();
          setCloudState({ cloudStatus: "error", cloudSubject: unauthorized ? null : undefined, cloudMessage: message });
        });
    }, SAVE_DEBOUNCE_MS);

    return () => { cancelled = true; window.clearTimeout(timeout); };
  }, [bootstrapReady, cloudSubject, getSnapshot, isInitialized, retryRevision, setCloudState, snapshot]);

  return { bootstrapReady } as const;
}
