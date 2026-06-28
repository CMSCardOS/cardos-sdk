/**
 * CardOS SDK — typed TypeScript client for the CardOS API (https://cardos.dev).
 *
 * @example
 * import { CardOS } from 'cardos';
 * const cardos = new CardOS({ apiKey: process.env.CARDOS_API_KEY! }); // cms_sk_test_… = sandbox
 * const products = await cardos.products.list();
 * const card = await cardos.cards.issue({ externalUserRef: '123456', product: products[0]?.product_code });
 */
import { Http, type HttpOptions } from './http.js';
import { Products, BalanceApi, Cards, Deposits, Statements, Analytics, Disputes, Kyc, Webhooks, Sandbox } from './resources.js';

export type CardOSOptions = HttpOptions;

export class CardOS {
  private readonly http: Http;
  readonly products: Products;
  readonly balance: BalanceApi;
  readonly cards: Cards;
  readonly deposits: Deposits;
  readonly statements: Statements;
  readonly analytics: Analytics;
  readonly disputes: Disputes;
  readonly kyc: Kyc;
  readonly webhooks: Webhooks;
  readonly sandbox: Sandbox;

  constructor(options: CardOSOptions) {
    this.http = new Http(options);
    this.products = new Products(this.http);
    this.balance = new BalanceApi(this.http);
    this.cards = new Cards(this.http);
    this.deposits = new Deposits(this.http);
    this.statements = new Statements(this.http);
    this.analytics = new Analytics(this.http);
    this.disputes = new Disputes(this.http);
    this.kyc = new Kyc(this.http);
    this.webhooks = new Webhooks(this.http);
    this.sandbox = new Sandbox(this.http);
  }

  /** Whether this client is in sandbox ('test') or production ('live'), derived from the key. */
  get mode(): 'test' | 'live' {
    return this.http.mode;
  }
}

export default CardOS;
export { CardOSError } from './errors.js';
export { verifyWebhookSignature } from './webhooks.js';
export * from './types.js';
