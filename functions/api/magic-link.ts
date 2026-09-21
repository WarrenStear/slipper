import { isDevMagicLinkEnabled, json, persistenceUnavailable, type Env } from "../_shared/session.ts";
import { readJsonRecord, RequestBodyError } from "../_shared/requestBody.ts";
import { postMagicLinkEmail, secureDeliveryUrl } from "../_shared/magicDelivery.ts";

function normalizeEmail(value: unknown) {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? email : null;
}

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!env.SIDTW_MAGIC_KV || !env.MAGIC_LINK_SECRET) return persistenceUnavailable();
  const development = isDevMagicLinkEnabled(env);
  const sender = env.EMAIL_WEBHOOK_URL ? secureDeliveryUrl(env.EMAIL_WEBHOOK_URL) : null;
  if ((!sender && !development) || (env.EMAIL_WEBHOOK_URL && !sender)) {
    return json({ error: "Restore email is unavailable. Your local journey is unchanged." }, 503);
  }
  const originUrl = secureDeliveryUrl(env.APP_ORIGIN || new URL(request.url).origin);
  if (!originUrl) return json({ error: "Restore email is not configured correctly." }, 503);

  let body: Record<string, unknown>;
  try { body = await readJsonRecord(request, 2_048); }
  catch (error) {
    return json({ error: error instanceof RequestBodyError ? error.message : "Could not read the request." }, error instanceof RequestBodyError ? error.status : 400);
  }
  const email = normalizeEmail(body.email);
  if (!email) return json({ error: "Valid email is required." }, 400);

  const tokenBytes = new Uint8Array(32);
  crypto.getRandomValues(tokenBytes);
  const token = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, "0")).join("");
  const tokenKey = `magic:${token}`;
  try {
    await env.SIDTW_MAGIC_KV.put(tokenKey, JSON.stringify({ email, createdAt: new Date().toISOString() }), { expirationTtl: 60 * 15 });
  } catch { return json({ error: "Could not prepare a restore link. Try again shortly." }, 503); }

  const magicLink = `${new URL(originUrl).origin}/?sidtw_token=${encodeURIComponent(token)}`;
  if (sender) {
    let delivered = false;
    try {
      delivered = await postMagicLinkEmail(sender, {
        to: email, subject: "Your Slipper in the Woods magic link",
        text: `Open this link to restore your forest journey: ${magicLink}`,
        html: `<p>Open this link to restore your forest journey:</p><p><a href="${magicLink}">${magicLink}</a></p>`,
      });
    } catch { /* Sender failure must never be reported as successful delivery. */ }
    if (!delivered) {
      await env.SIDTW_MAGIC_KV.delete(tokenKey).catch(() => undefined);
      return json({ error: "The restore email could not be sent. Try again shortly." }, 502);
    }
  }
  return json({ ok: true, devMagicLink: !sender && development ? magicLink : undefined });
};
