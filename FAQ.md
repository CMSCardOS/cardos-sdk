# FAQ

### What is this?
`cardos` is a typed, dependency-free TypeScript SDK for the [CardOS](https://cardos.dev) API.

### Do I need anything?
A CardOS API key — get one at https://cardos.dev/partner/developers. A `cms_sk_test_…` key runs in sandbox (no real money).

### Sandbox vs live?
The key prefix decides: `cms_sk_test_…` → sandbox, `cms_sk_live_…` → production. Read `cardos.mode`.

### Are money operations safe to retry?
Yes. `cards.issue` and `deposits.create` send a fresh `Idempotency-Key`; CardOS returns the same result on retry instead of creating a duplicate.

### How do I verify a webhook?
Use `verifyWebhookSignature(secret, header, rawBody)` with the **raw** request body (not the re-serialized JSON). It checks the HMAC and the timestamp (anti-replay).

### Does it work in the browser / edge runtimes?
The SDK targets Node ≥18 (uses `node:crypto` for the webhook verifier). For other runtimes, pass a custom `fetch`; the webhook helper needs a `crypto` HMAC. Never ship a live key to a browser.

### Where are the types?
Everything is typed — request params and response shapes are exported from the package. See `src/types.ts`.

### Bugs / requests?
https://github.com/CMSCardOS/cardos-sdk/issues
