/** The destination is operator configuration, never a URL from the request body. */
export function secureDeliveryUrl(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.hash ? url.href : null;
  } catch { return null; }
}

export async function postMagicLinkEmail(url: string, payload: Record<string, string>, timeoutMs = 8_000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST", redirect: "error", signal: controller.signal,
      headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    });
    await response.body?.cancel().catch(() => undefined);
    return response.ok;
  } finally { clearTimeout(timeout); }
}
