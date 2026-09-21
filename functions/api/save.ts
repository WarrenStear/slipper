import {
  CLOUD_JOURNEY_SCHEMA_VERSION,
  journeyKey,
  json,
  persistenceUnavailable,
  requireSubject,
  sanitizeJourney,
  type Env,
} from "../_shared/session.ts";
import { readJsonRecord, RequestBodyError } from "../_shared/requestBody.ts";

const MAX_REQUEST_BYTES = 128 * 1024;

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_JOURNEY_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();

  const subject = await requireSubject(request, env);
  if (!subject) return json({ error: "Unauthorized." }, 401);

  let body: Record<string, unknown>;
  try { body = await readJsonRecord(request, MAX_REQUEST_BYTES); }
  catch (error) {
    return json({ error: error instanceof RequestBodyError ? error.message : "Could not read the journey payload." }, error instanceof RequestBodyError ? error.status : 400);
  }
  const journey = sanitizeJourney(body.journey);
  if (!journey) return json({ error: "Invalid journey payload." }, 400);

  await env.SIDTW_JOURNEY_KV.put(journeyKey(subject), JSON.stringify(journey), {
    metadata: { schemaVersion: CLOUD_JOURNEY_SCHEMA_VERSION },
  });
  return json({ ok: true });
};
