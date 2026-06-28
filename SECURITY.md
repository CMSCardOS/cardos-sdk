# Security Policy

Report vulnerabilities privately to **security@cardos.dev** (please don't open a public issue). We aim to acknowledge within 72 hours.

## Notes
- The SDK is a thin client over the public CardOS REST API — no provider internals.
- Keep your API key in server-side env/secret storage. **Never ship a `cms_sk_live_…` key to a browser.**
- Card details are returned masked; full PAN/CVV are only delivered via a one-time hosted reveal link.
- Verify webhook signatures with `verifyWebhookSignature` using the raw body.
- Prefer a sandbox (`cms_sk_test_…`) key for development and CI.
