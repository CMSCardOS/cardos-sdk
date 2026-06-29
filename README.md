<div align="center">

# CardOS SDK

**Typed TypeScript SDK for the [CardOS](https://cardos.dev) API — issue and manage virtual cards.**

[![CI](https://github.com/CMSCardOS/cardos-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/CMSCardOS/cardos-sdk/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/cardos.svg)](https://www.npmjs.com/package/cardos)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)](https://nodejs.org)
[![Zero deps](https://img.shields.io/badge/dependencies-0-brightgreen)](./package.json)

</div>

A small, **dependency-free**, fully typed client for the CardOS REST API. Issue cards, top up balances, pull transactions, handle disputes and KYC, and verify webhooks — with first-class TypeScript types, automatic idempotency, retries and a typed error.

A `cms_sk_test_…` key runs in **sandbox** — no real money moves.

## Install

```bash
npm install cardos
```

## Quick start

```ts
import { CardOS } from 'cardos';

const cardos = new CardOS({ apiKey: process.env.CARDOS_API_KEY! }); // cms_sk_test_… = sandbox

// Pick a product and issue a card
const products = await cardos.products.list();
const card = await cardos.cards.issue({ externalUserRef: '123456', product: products[0]?.product_code });

// Check a balance, list transactions
const balance = await cardos.balance.get('123456');
const txns = await cardos.cards.transactions(card.card_id!);

console.log(cardos.mode); // 'test' | 'live'
```

> Get an API key at **[cardos.dev/partner/developers](https://cardos.dev/partner/developers)**.

## API surface

Everything is namespaced and typed:

```ts
cardos.products.list()
cardos.products.ratesByMerchant('github')

cardos.balance.get(externalUserRef)

cardos.cards.issue({ externalUserRef, product })   // idempotent
cardos.cards.get(cardId)
cardos.cards.freeze(cardId) / unfreeze(cardId) / close(cardId)
cardos.cards.setPin(cardId, '1234')
cardos.cards.setControls(cardId, { daily_max_minor: 5000, blocked_country: ['RU'] })
cardos.cards.reveal(cardId)         // one-time hosted PAN/CVV link
cardos.cards.session(cardId)        // hosted manage + transactions screens
cardos.cards.transactions(cardId, { limit: 50 })

cardos.deposits.create({ externalUserRef, amount: '100', method: 'usdt_trc20' })  // idempotent
cardos.deposits.confirmSandbox(depositId)          // sandbox only

cardos.statements.get(externalUserRef, { days: 30 })
cardos.analytics.spending(externalUserRef, { days: 30 })

cardos.disputes.file({ transactionId, reason: 'fraud' })
cardos.disputes.list({ status: 'open' })
cardos.disputes.get(disputeId)
cardos.disputes.update(disputeId, { status: 'under_review' })

cardos.kyc.start({ externalUserRef, sort: 'basic' })
cardos.kyc.status(uuid)

cardos.webhooks.register({ url, events: ['transaction', 'balance'] })
cardos.webhooks.list()

cardos.sandbox.simulateTransaction(cardId, { amount: '25.50', merchant: 'Starbucks', mcc: '5814' })
```

## Webhooks

Verify signed deliveries with a one-line helper — no need to reimplement the HMAC scheme:

```ts
import { verifyWebhookSignature } from 'cardos';

// In your webhook handler (use the RAW body, not the parsed JSON):
const ok = verifyWebhookSignature(endpointSecret, req.headers['x-cardos-signature'], rawBody);
if (!ok) return res.status(400).end();
```

## Errors

Every non-2xx response throws a typed `CardOSError`:

```ts
import { CardOSError } from 'cardos';

try {
  await cardos.cards.issue({ externalUserRef: 'u1' });
} catch (e) {
  if (e instanceof CardOSError) {
    console.error(e.status, e.code, e.message); // e.g. 409 not_configured ...
  }
}
```

## Configuration

```ts
new CardOS({
  apiKey: 'cms_sk_test_…',          // required
  baseUrl: 'https://cardos.dev/api/v1', // optional override
  timeoutMs: 20_000,                // per-request timeout
  maxRetries: 2,                    // retries for 408/429/5xx/network
  fetch: customFetch,               // optional (tests / non-Node runtimes)
});
```

- **Idempotent money operations** — `cards.issue` and `deposits.create` always carry an `Idempotency-Key`. For safety **across your own retries** (e.g. you retry after a timeout), pass a stable `idempotencyKey` and reuse the same value:
  ```ts
  const key = crypto.randomUUID();
  await cardos.cards.issue({ externalUserRef: '123456', idempotencyKey: key }); // reuse `key` on retry
  ```
- **Retry safety** — only GET requests and requests with an `Idempotency-Key` are auto-retried on timeout/network; a keyless write is never replayed.
- **Sandbox-first** — `cms_sk_test_…` keys move no real money.

## OpenAPI

The machine-readable spec lives in [`openapi.yaml`](./openapi.yaml) and at <https://cardos.dev/openapi-v1.yaml>. An interactive reference is at <https://cardos.dev/reference>.

## Links

- **CardOS** — <https://cardos.dev> · **Docs** — <https://cardos.dev/docs>
- **FAQ** — [FAQ.md](./FAQ.md) · **Changelog** — [CHANGELOG.md](./CHANGELOG.md) · **Security** — [SECURITY.md](./SECURITY.md)
- **MCP server** — <https://github.com/CMSCardOS/cardos-mcp>

## License

[MIT](./LICENSE)
