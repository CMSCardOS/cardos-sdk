import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Verify an outbound CardOS webhook signature.
 *
 * CardOS signs each delivery with:
 *   X-CardOS-Signature: t=<unix>,v1=<hex>
 *   v1 = HMAC_SHA256(secret, "<t>.<raw_body>")
 *
 * @param secret      The endpoint signing secret (returned once by register).
 * @param header      The raw `X-CardOS-Signature` header value.
 * @param rawBody     The exact raw request body string (do not re-serialize the parsed JSON).
 * @param toleranceSec Reject if the timestamp is older than this (anti-replay). Default 300s.
 * @returns true if the signature is valid and fresh.
 */
export function verifyWebhookSignature(secret: string, header: string | null | undefined, rawBody: string, toleranceSec = 300): boolean {
  if (!secret || !header) return false;
  const parts = Object.fromEntries(header.split(',').map((kv) => kv.split('=').map((s) => s.trim()) as [string, string]));
  const t = Number(parts.t);
  const v1 = parts.v1;
  if (!Number.isFinite(t) || !v1) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  return a.length === b.length && timingSafeEqual(a, b);
}
