import { journeyKey, json, persistenceUnavailable, sanitizeJourney, signSession, type Env } from "../_shared/session.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_MAGIC_KV || !env.SIDTW_JOURNEY_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "Missing token." }, 400);

  const tokenKey = `magic:${token}`;
  const stored = (await env.SIDTW_MAGIC_KV.get(tokenKey, "json")) as { email?: string } | null;
  if (!stored?.email) return json({ error: "Magic link is invalid or expired." }, 401);

  // Keep the restore link usable when its existing journey cannot be restored.
  const storedJourney = await env.SIDTW_JOURNEY_KV.get(journeyKey(stored.email));
  let journey: ReturnType<typeof sanitizeJourney> = null;
  if (storedJourney !== null) {
    try { journey = sanitizeJourney(JSON.parse(storedJourney)); }
    catch { /* Treat malformed JSON as an unreadable save, not a missing save. */ }
    if (!journey) return json({ error: "Your saved cloud journey uses an unsupported or invalid format. It has been left unchanged." }, 409);
  }

  await env.SIDTW_MAGIC_KV.delete(tokenKey);
  const sessionToken = await signSession(env, stored.email);

  return json({ ok: true, sessionToken, journey });
};
