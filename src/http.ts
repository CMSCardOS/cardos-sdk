import { randomUUID } from 'node:crypto';
import { CardOSError } from './errors.js';

export interface HttpOptions {
  apiKey: string;
  baseUrl?: string;
  /** Per-request timeout in ms (default 20000). */
  timeoutMs?: number;
  /** Retries for transient failures (408/429/5xx/network). Default 2. */
  maxRetries?: number;
  /** Optional custom fetch (e.g. for tests or non-Node runtimes). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Appended to the User-Agent for observability. */
  appInfo?: string;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Internal HTTP core: auth, timeout, bounded retries, idempotency, typed errors. */
export class Http {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly ua: string;

  constructor(opts: HttpOptions) {
    if (!opts.apiKey) throw new Error('CardOS: apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://cardos.dev/api/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.ua = `cardos-sdk${opts.appInfo ? ` ${opts.appInfo}` : ''}`;
    if (!this.fetchImpl) throw new Error('CardOS: global fetch is unavailable; pass opts.fetch (Node ≥18 has fetch built in)');
  }

  /** Sandbox keys start with cms_sk_test_. */
  get mode(): 'test' | 'live' {
    return this.apiKey.startsWith('cms_sk_live_') ? 'live' : 'test';
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: { query?: Record<string, unknown>; body?: unknown; idempotent?: boolean } = {}): Promise<T> {
    const qs = opts.query
      ? '?' +
        Object.entries(opts.query)
          .filter(([, v]) => v !== undefined && v !== null)
          .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
          .join('&')
      : '';
    const url = `${this.baseUrl}${path}${qs}`;
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, 'User-Agent': this.ua };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    if (opts.idempotent) headers['Idempotency-Key'] = randomUUID();

    let lastErr: CardOSError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
      try {
        const res = await this.fetchImpl(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal: ctrl.signal });
        const text = await res.text();
        let data: unknown = null;
        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }
        if (res.ok) return data as T;
        const e = (data as { error?: { code?: string; message?: string } } | null)?.error;
        lastErr = new CardOSError(e?.message ?? `CardOS ${method} ${path} → ${res.status}`, res.status, e?.code, data);
        if (RETRYABLE.has(res.status) && attempt < this.maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw lastErr;
      } catch (err) {
        if (err instanceof CardOSError) throw err;
        const isAbort = (err as Error).name === 'AbortError';
        lastErr = new CardOSError(isAbort ? `Request timed out after ${this.timeoutMs}ms` : `Network error: ${(err as Error).message}`, 0, isAbort ? 'timeout' : 'network');
        if (attempt < this.maxRetries) {
          await sleep(250 * 2 ** attempt);
          continue;
        }
        throw lastErr;
      } finally {
        clearTimeout(timer);
      }
    }
    throw lastErr ?? new CardOSError('request failed', 0, 'unknown');
  }
}
