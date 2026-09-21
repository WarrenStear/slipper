export class JourneyHttpError extends Error {
  readonly status: number;
  constructor(message: string, status: number) { super(message); this.status = status; }
}

/** Bounded network/response time; server errors never masquerade as successful saves. */
export async function fetchJourneyJson<T>(url: string, init: RequestInit = {}, timeoutMs = 15_000): Promise<T> {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (init.signal?.aborted) cancel();
  else init.signal?.addEventListener("abort", cancel, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; controller.abort(); }, timeoutMs);
  try {
    const headers = new Headers(init.headers);
    if (init.body !== undefined && !headers.has("content-type")) headers.set("content-type", "application/json");
    const response = await fetch(url, { ...init, headers, signal: controller.signal, cache: "no-store", redirect: "error" });
    const payload: unknown = await response.json().catch(() => null);
    if (timedOut) throw new Error("Cloud request timed out. Your local journey is unchanged.");
    if (!response.ok) {
      const message = payload && typeof payload === "object" && "error" in payload && typeof payload.error === "string"
        ? payload.error : `Cloud request failed: ${response.status}`;
      throw new JourneyHttpError(message, response.status);
    }
    if (!payload || typeof payload !== "object" || !("ok" in payload) || payload.ok !== true) {
      throw new Error("Cloud service returned an invalid response.");
    }
    return payload as T;
  } catch (error) {
    if (timedOut) throw new Error("Cloud request timed out. Your local journey is unchanged.");
    throw error;
  } finally {
    clearTimeout(timer);
    init.signal?.removeEventListener("abort", cancel);
  }
}
