import { randomUUID } from 'node:crypto';
import { CardOSError } from './errors.js';

export interface HttpOptions {
  apiKey: string;
  baseUrl?: string;
  /** Per-request timeout in ms (default 20000). */
  timeoutMs?: number;
  /** Retries for transient failures (408/429/5xx/network) on retry-safe requests. Default 2. */
  maxRetries?: number;
  /** Optional custom fetch (e.g. for tests or non-Node runtimes). Defaults to global fetch. */
  fetch?: typeof fetch;
  /** Appended to the User-Agent for observability. */
  appInfo?: string;
  /** Optional client-wide AbortSignal — aborts in-flight requests and pending backoff. */
  signal?: AbortSignal;
}

export interface RequestOptions {
  query?: Record<string, unknown>;
  body?: unknown;
  /** Generate a random Idempotency-Key (only when no idempotencyKey is supplied). */
  idempotent?: boolean;
  /** Caller-supplied stable Idempotency-Key — survives caller-side retries (use for money ops). */
  idempotencyKey?: string;
  /** Per-request AbortSignal, combined with the client signal and the timeout. */
  signal?: AbortSignal;
}

const RETRYABLE = new Set([408, 429, 500, 502, 503, 504]);

/** Abortable sleep — rejects with AbortError if the signal fires first. */
function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

/** Combine the per-request timeout with any external signals into one controller. */
function linkedSignal(timeoutMs: number, externals: (AbortSignal | undefined)[]): { signal: AbortSignal; cleanup: () => void } {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new DOMException(`Request timed out after ${timeoutMs}ms`, 'TimeoutError')), timeoutMs);
  const handlers: Array<{ s: AbortSignal; h: () => void }> = [];
  for (const s of externals) {
    if (!s) continue;
    if (s.aborted) ctrl.abort(s.reason);
    else {
      const h = () => ctrl.abort(s.reason);
      s.addEventListener('abort', h, { once: true });
      handlers.push({ s, h });
    }
  }
  return {
    signal: ctrl.signal,
    cleanup: () => {
      clearTimeout(timer);
      for (const { s, h } of handlers) s.removeEventListener('abort', h);
    },
  };
}

/** Parse a Retry-After header (delta-seconds or HTTP-date) into ms, or null. */
function retryAfterMs(res: Response): number | null {
  const ra = res.headers?.get?.('retry-after');
  if (!ra) return null;
  const secs = Number(ra);
  if (Number.isFinite(secs)) return Math.max(0, secs * 1000);
  const when = Date.parse(ra);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
}

/** Internal HTTP core: auth, timeout, idempotency, retry-safe bounded retries, typed errors. */
export class Http {
  readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetchImpl: typeof fetch;
  private readonly ua: string;
  private readonly clientSignal?: AbortSignal;

  constructor(opts: HttpOptions) {
    if (!opts.apiKey) throw new Error('CardOS: apiKey is required');
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? 'https://cardos.dev/api/v1').replace(/\/$/, '');
    this.timeoutMs = opts.timeoutMs ?? 20_000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.fetchImpl = opts.fetch ?? globalThis.fetch;
    this.ua = `cardos-sdk${opts.appInfo ? ` ${opts.appInfo}` : ''}`;
    this.clientSignal = opts.signal;
    if (!this.fetchImpl) throw new Error('CardOS: global fetch is unavailable; pass opts.fetch (Node ≥18 has fetch built in)');
  }

  /** Sandbox keys start with cms_sk_test_. */
  get mode(): 'test' | 'live' {
    return this.apiKey.startsWith('cms_sk_live_') ? 'live' : 'test';
  }

  private buildUrl(path: string, query?: Record<string, unknown>): string {
    if (!query) return `${this.baseUrl}${path}`;
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v === undefined || v === null) continue;
      if (Array.isArray(v)) v.forEach((item) => item !== undefined && item !== null && sp.append(k, String(item)));
      else sp.append(k, String(v));
    }
    const qs = sp.toString();
    return `${this.baseUrl}${path}${qs ? `?${qs}` : ''}`;
  }

  async request<T>(method: 'GET' | 'POST' | 'PATCH' | 'DELETE', path: string, opts: RequestOptions = {}): Promise<T> {
    const url = this.buildUrl(path, opts.query);
    const headers: Record<string, string> = { Authorization: `Bearer ${this.apiKey}`, 'User-Agent': this.ua };
    if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
    const idemKey = opts.idempotencyKey ?? (opts.idempotent ? randomUUID() : undefined);
    if (idemKey) headers['Idempotency-Key'] = idemKey;

    // Only retry requests we can safely replay: GET, or anything carrying an Idempotency-Key
    // (a keyless POST/PATCH may have been applied server-side before a timeout — never replay it).
    const retrySafe = method === 'GET' || idemKey !== undefined;

    let lastErr: CardOSError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const { signal, cleanup } = linkedSignal(this.timeoutMs, [this.clientSignal, opts.signal]);
      try {
        const res = await this.fetchImpl(url, { method, headers, body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined, signal });
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
        if (retrySafe && RETRYABLE.has(res.status) && attempt < this.maxRetries) {
          await this.wait(retryAfterMs(res) ?? this.backoff(attempt), opts.signal);
          continue;
        }
        throw lastErr;
      } catch (err) {
        if (err instanceof CardOSError) throw err;
        const name = (err as Error).name;
        if (name === 'AbortError') throw new CardOSError('Request aborted', 0, 'aborted');
        const isTimeout = name === 'TimeoutError';
        lastErr = new CardOSError(isTimeout ? `Request timed out after ${this.timeoutMs}ms` : `Network error: ${(err as Error).message}`, 0, isTimeout ? 'timeout' : 'network');
        if (retrySafe && attempt < this.maxRetries) {
          await this.wait(this.backoff(attempt), opts.signal);
          continue;
        }
        throw lastErr;
      } finally {
        cleanup();
      }
    }
    throw lastErr ?? new CardOSError('request failed', 0, 'unknown');
  }

  /** Capped exponential backoff with full jitter (ms). */
  private backoff(attempt: number): number {
    const base = Math.min(8000, 250 * 2 ** attempt);
    return Math.floor(base / 2 + Math.random() * (base / 2));
  }

  /** Abortable backoff wait honoring client + per-request signals (no timeout of its own). */
  private async wait(ms: number, reqSignal?: AbortSignal): Promise<void> {
    const ctrl = new AbortController();
    const externals = [this.clientSignal, reqSignal].filter((s): s is AbortSignal => !!s);
    const handlers = externals.map((s) => {
      if (s.aborted) ctrl.abort(s.reason);
      const h = () => ctrl.abort(s.reason);
      s.addEventListener('abort', h, { once: true });
      return { s, h };
    });
    try {
      await sleep(ms, ctrl.signal);
    } finally {
      for (const { s, h } of handlers) s.removeEventListener('abort', h);
    }
  }
}
