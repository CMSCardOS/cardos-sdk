# Contributing

```bash
npm install
npm run build       # esbuild (esm+cjs) + tsc declarations
npm test            # vitest (fetch is injected/mocked; no network)
npm run typecheck
```

## Layout
- `src/http.ts` — HTTP core (auth, timeout, retries, idempotency, typed errors).
- `src/resources.ts` — namespaced resource classes.
- `src/types.ts` — public request/response types.
- `src/webhooks.ts` — signature verification.
- `src/index.ts` — the `CardOS` class + exports.

## Guidelines
- **Keep it dependency-free.** No runtime deps; Node built-ins only.
- Add an endpoint as a method on the right resource class, with typed params/response, then a test.
- Money methods set `idempotent: true`.
- Run `npm run typecheck && npm test` before a PR. CI must pass.
