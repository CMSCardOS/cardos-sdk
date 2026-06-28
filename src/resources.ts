import type { Http } from './http.js';
import type {
  Product, Balance, Card, CardTransaction, Deposit, Dispute, KycSession, RevealLink, CardSession,
  SpendControls, DepositMethod, DisputeReason, DisputeStatus, WebhookEvent,
} from './types.js';

const enc = encodeURIComponent;

export class Products {
  constructor(private http: Http) {}
  /** List available card products. */
  list = () => this.http.request<{ products: Product[] }>('GET', '/products').then((r) => r.products);
  /** Per-merchant pricing. */
  ratesByMerchant = (merchant: string) => this.http.request<{ merchant: string; rates: { product_code: string; rate: string }[] }>('GET', '/products/rates', { query: { merchant } });
}

export class BalanceApi {
  constructor(private http: Http) {}
  /** Get an end user's available balance. */
  get = (externalUserRef: string) => this.http.request<Balance>('GET', '/balance', { query: { external_user_ref: externalUserRef } });
}

export class Cards {
  constructor(private http: Http) {}
  /** Issue a virtual card (idempotent). */
  issue = (params: { externalUserRef: string; product?: string }) =>
    this.http.request<Card>('POST', '/cards', { body: { external_user_ref: params.externalUserRef, ...(params.product ? { product: params.product } : {}) }, idempotent: true });
  /** Masked card details. */
  get = (cardId: string) => this.http.request<Card>('GET', `/cards/${enc(cardId)}`);
  freeze = (cardId: string) => this.http.request<{ status: string }>('POST', `/cards/${enc(cardId)}/freeze`);
  unfreeze = (cardId: string) => this.http.request<{ status: string }>('POST', `/cards/${enc(cardId)}/unfreeze`);
  close = (cardId: string) => this.http.request<{ status: string }>('POST', `/cards/${enc(cardId)}/kill`);
  setPin = (cardId: string, pin: string) => this.http.request<{ status: string }>('POST', `/cards/${enc(cardId)}/set-pin`, { body: { pin } });
  setControls = (cardId: string, controls: SpendControls) => this.http.request<unknown>('POST', `/cards/${enc(cardId)}/controls`, { body: controls });
  /** Mint a one-time hosted PAN/CVV reveal link. */
  reveal = (cardId: string) => this.http.request<RevealLink>('POST', `/cards/${enc(cardId)}/reveal`);
  /** Mint hosted manage + transactions screens for the end user. */
  session = (cardId: string) => this.http.request<CardSession>('POST', `/cards/${enc(cardId)}/session`);
  transactions = (cardId: string, opts: { limit?: number } = {}) => this.http.request<{ transactions: CardTransaction[] }>('GET', `/cards/${enc(cardId)}/transactions`, { query: { limit: opts.limit } }).then((r) => r.transactions);
}

export class Deposits {
  constructor(private http: Http) {}
  /** Create a crypto deposit invoice (idempotent). amount is a decimal string, e.g. "100". */
  create = (params: { externalUserRef: string; amount: string; method?: DepositMethod }) =>
    this.http.request<Deposit>('POST', '/deposits', { body: { external_user_ref: params.externalUserRef, amount: params.amount, method: params.method ?? 'usdt_trc20' }, idempotent: true });
  /** [sandbox] Confirm a pending deposit (test key only). */
  confirmSandbox = (depositId: string) => this.http.request<unknown>('POST', `/sandbox/deposits/${enc(depositId)}/confirm`);
}

export class Statements {
  constructor(private http: Http) {}
  get = (externalUserRef: string, opts: { days?: number } = {}) => this.http.request<unknown>('GET', '/statements', { query: { external_user_ref: externalUserRef, days: opts.days } });
}

export class Analytics {
  constructor(private http: Http) {}
  spending = (externalUserRef: string, opts: { days?: number } = {}) => this.http.request<unknown>('GET', '/analytics/spending', { query: { external_user_ref: externalUserRef, days: opts.days } });
}

export class Disputes {
  constructor(private http: Http) {}
  file = (params: { transactionId: string; reason: DisputeReason; note?: string }) =>
    this.http.request<{ dispute: Dispute }>('POST', '/disputes', { body: { transaction_id: params.transactionId, reason: params.reason, ...(params.note ? { note: params.note } : {}) } }).then((r) => r.dispute);
  list = (opts: { externalUserRef?: string; status?: DisputeStatus; limit?: number } = {}) =>
    this.http.request<{ disputes: Dispute[] }>('GET', '/disputes', { query: { external_user_ref: opts.externalUserRef, status: opts.status, limit: opts.limit } }).then((r) => r.disputes);
  get = (disputeId: string) => this.http.request<{ dispute: Dispute }>('GET', `/disputes/${enc(disputeId)}`).then((r) => r.dispute);
  update = (disputeId: string, patch: { status?: DisputeStatus; note?: string; providerRef?: string }) =>
    this.http.request<{ dispute: Dispute }>('PATCH', `/disputes/${enc(disputeId)}`, { body: { status: patch.status, note: patch.note, provider_ref: patch.providerRef } }).then((r) => r.dispute);
}

export class Kyc {
  constructor(private http: Http) {}
  start = (params: { externalUserRef: string; sort?: string }) => this.http.request<{ kyc: KycSession }>('POST', '/kyc', { body: { external_user_ref: params.externalUserRef, sort: params.sort ?? 'basic' } }).then((r) => r.kyc);
  status = (uuid: string) => this.http.request<{ kyc: KycSession }>('GET', `/kyc/${enc(uuid)}`).then((r) => r.kyc);
}

export class Webhooks {
  constructor(private http: Http) {}
  /** Register an HTTPS endpoint; the signing secret is returned once. */
  register = (params: { url: string; events?: WebhookEvent[] }) => this.http.request<unknown>('POST', '/webhook-endpoints', { body: { url: params.url, ...(params.events ? { events: params.events } : {}) } });
  list = () => this.http.request<unknown>('GET', '/webhook-endpoints');
}

export class Sandbox {
  constructor(private http: Http) {}
  /** Inject a test card transaction (test key only). */
  simulateTransaction = (cardId: string, tx: { type?: 'expense' | 'refund' | 'reversal' | 'authorization'; amount: string; merchant?: string; mcc?: string; country?: string }) =>
    this.http.request<unknown>('POST', `/sandbox/cards/${enc(cardId)}/transactions`, { body: { type: 'expense', ...tx } });
}
