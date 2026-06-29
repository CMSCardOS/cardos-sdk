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

  // Parse "t=…,v1=…[,v1=…]" as a list of pairs — tolerate whitespace, ignore malformed
  // segments, and collect every v1 (more than one appears during signing-key rotation).
  let t: number | undefined;
  const candidates: string[] = [];
  for (const seg of header.split(',')) {
    const eq = seg.indexOf('=');
    if (eq < 0) continue;
    const key = seg.slice(0, eq).trim();
    const val = seg.slice(eq + 1).trim();
    if (key === 't' && t === undefined) t = Number(val);
    else if (key === 'v1' && /^[0-9a-f]+$/i.test(val)) candidates.push(val);
  }
  if (t === undefined || !Number.isFinite(t) || candidates.length === 0) return false;
  if (Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;

  const expected = Buffer.from(createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex'));
  // Constant-time compare against each candidate; accept if any valid signature matches.
  return candidates.some((c) => {
    const b = Buffer.from(c);
    return b.length === expected.length && timingSafeEqual(expected, b);
  });
}
