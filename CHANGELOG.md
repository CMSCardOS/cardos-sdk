# Changelog

This project adheres to [Semantic Versioning](https://semver.org).

## [0.1.0] — 2026-06-28
### Added
- Initial release: typed, dependency-free SDK for the CardOS API.
- Namespaced resources: products, balance, cards, deposits, statements, analytics, disputes, kyc, webhooks, sandbox.
- Automatic idempotency on money operations; bounded retries; per-request timeout; typed `CardOSError`.
- `verifyWebhookSignature` helper. ESM + CJS builds with bundled type declarations. Zero runtime dependencies.
