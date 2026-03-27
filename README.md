# npmjs.dev

A lightweight in‑browser playground to explore and run npm packages instantly—no local install required. Enter a package in the URL, edit code, run it, and view the package’s README side‑by‑side.

Checkout: [https://npmjs.dev/](https://npmjs.dev/)

Or run it locally: `npm run dev`

> This project is an independent experiment and not affiliated with npm, Inc.

## Features

- Triple execution engines:
  - QuickJS (WASM) – fast startup, sandboxed
  - Browser (iframe + import map via esm.sh)
  - Cloudflare Dynamic Workers – runtime bundling + edge isolate execution
- Automatic sample code based on URL package
- Live console capture (log / info / warn / error)
- README auto-fetch from unpkg (fallback name variants)
- Zero build step for adding packages—import and run
- Clean React + TypeScript architecture (Vite powered)

## Cloudflare Engine

This repo now includes an optional Cloudflare-backed execution engine powered by [Dynamic Workers](https://developers.cloudflare.com/dynamic-workers/).

- The browser app stays fully usable without Cloudflare.
- `wrangler` deploys only the Dynamic Worker host at `src/cloudflare-worker/host.ts`.
- The Vercel frontend can call that Worker through `VITE_CLOUDFLARE_EXECUTOR_API`.
- Dynamic Workers run bundled user code in a fresh edge isolate with outbound Internet access blocked by default.

### Deploy the Cloudflare Worker

```sh
npm install
npm run deploy:cloudflare
```

After deploy:

- Set `VITE_CLOUDFLARE_EXECUTOR_API` in Vercel to your Worker origin, for example `https://npmjs-dev.<subdomain>.workers.dev`
- If your frontend origin is not `https://npmjs.dev`, update `ALLOWED_ORIGINS` in [wrangler.jsonc](/Volumes/TiSSD/git/npmjs.dev/wrangler.jsonc) or in the Cloudflare dashboard before deploying

For local development:

```sh
npm run dev
```

This starts Wrangler and Vite together. In development, the browser uses same-origin `/api/*` requests and Vite proxies them to the local Worker automatically.

See [docs/cloudflare-dynamic-workers.md](/Volumes/TiSSD/git/npmjs.dev/docs/cloudflare-dynamic-workers.md) for the design notes, tradeoffs, and rollout details.

## License

MIT
