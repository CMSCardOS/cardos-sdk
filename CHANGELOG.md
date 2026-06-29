# Changelog

This project adheres to [Semantic Versioning](https://semver.org).

## [0.1.1] — 2026-06-29
### Fixed (post-publish review: codex + grok)
- **Idempotency across caller retries** — `cards.issue` / `deposits.create` now accept a stable `idempotencyKey`; reuse it on retry so an operation is never applied twice.
- **Retry safety** — only GET requests and requests carrying an `Idempotency-Key` are retried on timeout/network; a keyless POST/PATCH is never replayed (could have applied server-side).
- **Backoff** — capped exponential backoff with full jitter; honors `Retry-After` on 429/503.
- **AbortSignal** — client- and per-request `signal` support; in-flight requests and backoff are abortable.
- **Webhook signatures** — robust header parsing, hex validation, and multiple-`v1` support (key rotation), constant-time compare.
- **Query** — `URLSearchParams` serialization (no trailing `?`, array support).
- **Types** — `WebhookEvent` corrected to `credited|issued|transaction|card_status|balance`; `Deposit.status` added.

## [0.1.0] — 2026-06-28
### Added
- Initial release: typed, dependency-free SDK for the CardOS API.
- Namespaced resources: products, balance, cards, deposits, statements, analytics, disputes, kyc, webhooks, sandbox.
- Automatic idempotency on money operations; bounded retries; per-request timeout; typed `CardOSError`.
- `verifyWebhookSignature` helper. ESM + CJS builds with bundled type declarations. Zero runtime dependencies.
