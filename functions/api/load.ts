import { journeyKey, json, persistenceUnavailable, requireSubject, sanitizeJourney, type Env } from "../_shared/session";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_JOURNEY_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();

  const subject = await requireSubject(request, env);
  if (!subject) return json({ error: "Unauthorized." }, 401);

  const storedJourney = await env.SIDTW_JOURNEY_KV.get<unknown>(journeyKey(subject), "json");
  const journey = storedJourney === null ? null : sanitizeJourney(storedJourney);
  return json({ ok: true, journey });
};
