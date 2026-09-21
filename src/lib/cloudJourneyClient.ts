import type { CloudJourneySnapshot } from "../stores/useJourneyStore";
import { readBrowserStorage, removeBrowserStorage, writeBrowserStorage } from "./safeStorage.ts";
import { createLatestTaskQueue } from "./latestTaskQueue.ts";
import { fetchJourneyJson } from "./journeyTransport.ts";

const SESSION_STORAGE_KEY = "sidtw:session-token";
// Only used when the browser denies persistence. Never written into journey saves.
let sessionOverride: string | null | undefined;

function decodeBase64Url(value: string) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (value.length % 4)) % 4);
  return window.atob(padded);
}

export function getJourneySessionToken() {
  return sessionOverride !== undefined ? sessionOverride : readBrowserStorage(SESSION_STORAGE_KEY);
}

export function setJourneySessionToken(token: string) {
  sessionOverride = token;
  if (writeBrowserStorage(SESSION_STORAGE_KEY, token)) sessionOverride = undefined;
}

export function clearJourneySessionToken() {
  sessionOverride = null;
  if (removeBrowserStorage(SESSION_STORAGE_KEY)) sessionOverride = undefined;
}

export function getSessionSubject(token = getJourneySessionToken()) {
  if (!token || typeof window === "undefined") return null;
  try {
    const [payload] = token.split(".");
    if (!payload) return null;
    const decoded = JSON.parse(decodeBase64Url(payload)) as { sub?: unknown };
    return typeof decoded.sub === "string" ? decoded.sub : null;
  } catch { return null; }
}

export async function requestMagicLink(email: string) {
  return fetchJourneyJson<{ ok: true; devMagicLink?: string }>("/api/magic-link", {
    method: "POST", body: JSON.stringify({ email }),
  });
}

export async function verifyMagicLink(token: string) {
  const payload = await fetchJourneyJson<{ ok: true; sessionToken: string; journey?: CloudJourneySnapshot | null }>(`/api/verify?token=${encodeURIComponent(token)}`);
  if (typeof payload.sessionToken !== "string" || !payload.sessionToken) throw new Error("Cloud service returned an invalid session.");
  setJourneySessionToken(payload.sessionToken);
  return payload;
}

export async function loadCloudJourney() {
  const token = getJourneySessionToken();
  if (!token) return null;
  return fetchJourneyJson<{ ok: true; journey: CloudJourneySnapshot | null }>("/api/load", {
    method: "GET", headers: { authorization: `Bearer ${token}` },
  });
}

type SaveResult = { ok: true } | { ok: false; skipped: true };
// Module scope serializes requests even when snapshot effects rerun while saving.
const saves = createLatestTaskQueue<{ body: string; token: string }, SaveResult>(async item => {
  if (getJourneySessionToken() !== item.token) return { ok: false, skipped: true };
  return fetchJourneyJson<{ ok: true }>("/api/save", {
    method: "POST", headers: { authorization: `Bearer ${item.token}` }, body: item.body,
  });
});

export async function saveCloudJourney(snapshot: CloudJourneySnapshot, token = getJourneySessionToken()): Promise<SaveResult> {
  if (!token) return { ok: false, skipped: true };
  const result = await saves.enqueue({ body: JSON.stringify({ journey: snapshot }), token });
  return result.status === "written" ? result.value : { ok: false, skipped: true };
}
