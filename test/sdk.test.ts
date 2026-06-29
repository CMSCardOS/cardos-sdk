import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';
import { CardOS, CardOSError, verifyWebhookSignature } from '../src/index.js';

function fakeFetch(seq: Array<{ ok?: boolean; status?: number; body?: unknown }>) {
  let i = 0;
  return vi.fn(async () => {
    const r = seq[Math.min(i, seq.length - 1)];
    i++;
    return { ok: r.ok ?? true, status: r.status ?? 200, text: async () => (r.body === undefined ? '' : JSON.stringify(r.body)) } as Response;
  });
}

describe('CardOS SDK', () => {
  it('requires an apiKey', () => {
    expect(() => new CardOS({ apiKey: '' })).toThrow(/apiKey/);
  });

  it('derives mode from the key prefix', () => {
    expect(new CardOS({ apiKey: 'cms_sk_test_x' }).mode).toBe('test');
    expect(new CardOS({ apiKey: 'cms_sk_live_x' }).mode).toBe('live');
  });

  it('products.list unwraps the products array with Bearer auth', async () => {
    const f = fakeFetch([{ body: { products: [{ product_code: 'VIRT-USD-NOKYC' }, { product_code: 'VIRT-USD-KYC' }] } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f });
    const products = await cardos.products.list();
    expect(products).toHaveLength(2);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain('/products');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer cms_sk_test_x' });
  });

  it('cards.issue is idempotent (sends Idempotency-Key)', async () => {
    const f = fakeFetch([{ status: 201, body: { card_id: 'c_1', status: 'pending' } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f });
    const card = await cardos.cards.issue({ externalUserRef: 'u1', product: 'VIRT-USD-NOKYC' });
    expect(card.card_id).toBe('c_1');
    expect((f.mock.calls[0]![1] as RequestInit).headers).toHaveProperty('Idempotency-Key');
  });

  it('throws a typed CardOSError on 4xx', async () => {
    const f = fakeFetch([{ ok: false, status: 401, body: { error: { code: 'unauthorized', message: 'Invalid or missing API key.' } } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f, maxRetries: 0 });
    await expect(cardos.balance.get('u1')).rejects.toBeInstanceOf(CardOSError);
    await expect(cardos.balance.get('u1')).rejects.toMatchObject({ status: 401, code: 'unauthorized' });
  });

  it('retries transient 503 then succeeds', async () => {
    const f = fakeFetch([{ ok: false, status: 503 }, { body: { products: [] } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f, maxRetries: 1 });
    await expect(cardos.products.list()).resolves.toEqual([]);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('reuses a caller-supplied idempotencyKey (safe across caller retries)', async () => {
    const f = fakeFetch([{ status: 201, body: { card_id: 'c_1' } }, { status: 201, body: { card_id: 'c_1' } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f });
    const key = 'idem-123';
    await cardos.cards.issue({ externalUserRef: 'u1', idempotencyKey: key });
    await cardos.cards.issue({ externalUserRef: 'u1', idempotencyKey: key });
    const k1 = (f.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    const k2 = (f.mock.calls[1]![1] as RequestInit).headers as Record<string, string>;
    expect(k1['Idempotency-Key']).toBe(key);
    expect(k2['Idempotency-Key']).toBe(key); // same key on the retry — server dedupes
  });

  it('does NOT retry a keyless write on network error', async () => {
    const f = vi.fn(async () => {
      throw Object.assign(new Error('boom'), { name: 'TypeError' });
    });
    // file_dispute is a POST without an Idempotency-Key → must not be replayed
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f as unknown as typeof fetch, maxRetries: 3 });
    await expect(cardos.disputes.file({ transactionId: 't1', reason: 'fraud' })).rejects.toBeInstanceOf(CardOSError);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('omits the query string when all params are undefined', async () => {
    const f = fakeFetch([{ body: { transactions: [] } }]);
    const cardos = new CardOS({ apiKey: 'cms_sk_test_x', fetch: f });
    await cardos.cards.transactions('c1', {});
    expect(String(f.mock.calls[0]![0])).not.toContain('?');
  });
});

describe('verifyWebhookSignature', () => {
  const secret = 'whsec_test';
  const body = '{"type":"transaction","data":{"id":"t1"}}';
  const sign = (t: number, b: string) => createHmac('sha256', secret).update(`${t}.${b}`).digest('hex');

  it('accepts a valid, fresh signature', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(secret, `t=${t},v1=${sign(t, body)}`, body)).toBe(true);
  });
  it('rejects a tampered body', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(secret, `t=${t},v1=${sign(t, body)}`, body + 'x')).toBe(false);
  });
  it('rejects a stale timestamp', () => {
    const t = Math.floor(Date.now() / 1000) - 10_000;
    expect(verifyWebhookSignature(secret, `t=${t},v1=${sign(t, body)}`, body)).toBe(false);
  });
  it('rejects a wrong secret', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature('other', `t=${t},v1=${sign(t, body)}`, body)).toBe(false);
  });
  it('accepts when one of several v1 matches (key rotation)', () => {
    const t = Math.floor(Date.now() / 1000);
    const header = `t=${t},v1=${'0'.repeat(64)},v1=${sign(t, body)}`;
    expect(verifyWebhookSignature(secret, header, body)).toBe(true);
  });
  it('rejects a non-hex v1', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(secret, `t=${t},v1=zzzz`, body)).toBe(false);
  });
  it('tolerates whitespace and ignores malformed segments', () => {
    const t = Math.floor(Date.now() / 1000);
    expect(verifyWebhookSignature(secret, ` t=${t} , garbage , v1=${sign(t, body)} `, body)).toBe(true);
  });
});
