import { journeyKey, json, persistenceUnavailable, requireSubject, sanitizeJourney, type Env } from "../_shared/session.ts";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_JOURNEY_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();

  const subject = await requireSubject(request, env);
  if (!subject) return json({ error: "Unauthorized." }, 401);

  // Read text so a stored JSON null is distinguishable from a missing KV key.
  const storedJourney = await env.SIDTW_JOURNEY_KV.get(journeyKey(subject));
  let journey: ReturnType<typeof sanitizeJourney> = null;
  if (storedJourney !== null) {
    try { journey = sanitizeJourney(JSON.parse(storedJourney)); }
    catch { /* Invalid stored JSON must not become an empty, writable journey. */ }
    if (!journey) return json({ error: "Your saved cloud journey uses an unsupported or invalid format. It has been left unchanged." }, 409);
  }
  return json({ ok: true, journey });
};
