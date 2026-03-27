# Cloudflare Dynamic Workers Integration

## Summary

This project now supports Cloudflare Dynamic Workers as a third execution engine.

It is a strong fit for `npmjs.dev` because the product is about running untrusted package snippets quickly, with minimal setup. Dynamic Workers give us a server-side, edge-isolated runtime that is closer to real Cloudflare Workers than either of the current in-browser engines.

## Research Highlights

- Cloudflare announced Dynamic Workers open beta on March 24, 2026 for paid Workers users.
- The feature is designed for on-demand sandboxed code execution and explicitly calls out AI code mode, previews, automations, and user-supplied code as primary use cases.
- `load()` creates a fresh Worker for one-off execution. `get(id, callback)` keeps Workers warm for repeated requests.
- Dynamic Workers do not compile TypeScript or resolve npm packages on their own. Cloudflare recommends `@cloudflare/worker-bundler` for that step.
- `globalOutbound: null` blocks all outbound `fetch()` and `connect()` calls, which makes it a good default for a public playground.

## Why It Adds New Capability

Compared with the existing engines:

- QuickJS is lightweight and local, but it is not a real Workers runtime and its module story is limited.
- Browser mode can import from `esm.sh`, but it runs in the user’s page context and is constrained by browser semantics.
- Dynamic Workers add a remote edge isolate with a Workers-native runtime, server-side npm bundling, and a much stronger sandbox boundary.

Net-new capabilities:

- Runtime bundling of npm dependencies with `@cloudflare/worker-bundler`
- Execution inside Cloudflare’s Workers runtime instead of the browser
- A secure default network posture with outbound access disabled
- A clean future extension point for curated bindings or gated egress

## Design Decisions

### 1. Keep the frontend contract small

The app still thinks in terms of `execute(code) -> logs | error`.

The new engine lives behind two endpoints:

- `GET /api/engines/cloudflare`
- `POST /api/execute/cloudflare`

This keeps the React app simple and avoids leaking Cloudflare-specific concepts into the editor UI.

### 2. Use a host Worker

The browser cannot create Dynamic Workers directly. A parent Worker is required to hold the `worker_loaders` binding and call `env.LOADER.load(...)`.

The host Worker lives at:

- `src/cloudflare-worker/host.ts`

### 3. Use `load()` instead of `get()`

This was a deliberate choice.

`npmjs.dev` executes ad hoc snippets, and user code should re-run from a clean module graph each time the user clicks Run. `get()` is attractive for cost and warm isolates, but it would cache module evaluation semantics in ways that do not match the current playground behavior. `load()` matches the product’s one-shot execution model.

### 4. Bundle before execution

Dynamic Workers do not have a build step. We generate a tiny virtual project in memory and pass it to `@cloudflare/worker-bundler`, which produces `mainModule` and `modules` for the Worker Loader API.

### 5. Block outbound network access

Every dynamically created Worker is launched with:

```ts
globalOutbound: null
```

This avoids turning the endpoint into a public fetch proxy. It also keeps the security model straightforward: code can use bundled dependencies and built-in Workers APIs, but not arbitrary Internet egress.

## Request Flow

1. The React app selects the `Cloudflare` engine.
2. `CloudflareExecutorEngine` health-checks the host Worker.
3. On Run, the app POSTs the current snippet to `/api/execute/cloudflare`.
4. The host Worker builds a virtual project:
   - `src/index.ts`: execution wrapper
   - `src/user-code.tsx`: user snippet
   - `package.json`: minimal package metadata
5. `@cloudflare/worker-bundler` resolves npm imports and compiles the project.
6. The host Worker creates a fresh Dynamic Worker with `env.LOADER.load(...)`.
7. The wrapper captures `console.*`, imports the user module, and returns `{ logs, error }` as JSON.
8. The browser renders the result exactly like the existing engines.

## Security and Operational Notes

- The endpoint requires a valid browser `Origin` header for execution requests.
- By default, same-origin requests are allowed.
- For split deployments, set `ALLOWED_ORIGINS` in the Worker environment.
- The Worker enforces a 32 KiB code size limit for this engine.
- Outbound Internet access is blocked inside the dynamic isolate.

This is intentionally conservative. If we later want richer integrations, the next step should be capability-based bindings or a controlled egress gateway, not full open networking.

## Deployment

### Recommended

Deploy only the Dynamic Worker host to Cloudflare and keep the frontend on Vercel:

```sh
npm run deploy:cloudflare
```

Then:

1. Set `VITE_CLOUDFLARE_EXECUTOR_API` in Vercel to the deployed Worker origin.
2. Set `ALLOWED_ORIGINS` on the Worker to your Vercel origin when the frontend and API do not share a host.

### Local testing

Run:

```sh
npm run dev
```

This now:

- starts Wrangler on `127.0.0.1:8787`
- waits for the Cloudflare health endpoint
- starts Vite after the Worker is ready
- proxies browser `/api/*` requests to the local Worker

For local loopback development, `localhost` and `127.0.0.1` origins are allowed automatically. `ALLOWED_ORIGINS` is required for non-local split-origin setups such as Vercel frontend plus Cloudflare API.

## Future Improvements

- Add a curated capability binding layer for package metadata or registry APIs
- Add an opt-in egress gateway instead of the current hard block
- Stream logs progressively if we want a more terminal-like execution experience
- Add usage controls or rate limiting if this engine is exposed on a public deployment
