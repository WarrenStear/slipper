import { journeyKey, json, persistenceUnavailable, sanitizeJourney, signSession, type Env } from "../_shared/session";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_MAGIC_KV || !env.SIDTW_JOURNEY_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();

  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  if (!token) return json({ error: "Missing token." }, 400);

  const tokenKey = `magic:${token}`;
  const stored = (await env.SIDTW_MAGIC_KV.get(tokenKey, "json")) as { email?: string } | null;
  if (!stored?.email) return json({ error: "Magic link is invalid or expired." }, 401);

  await env.SIDTW_MAGIC_KV.delete(tokenKey);

  const sessionToken = await signSession(env, stored.email);
  const storedJourney = await env.SIDTW_JOURNEY_KV.get<unknown>(journeyKey(stored.email), "json");
  const journey = storedJourney === null ? null : sanitizeJourney(storedJourney);

  return json({ ok: true, sessionToken, journey });
};
