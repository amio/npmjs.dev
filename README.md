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

For local development:

```sh
npm run dev
```

This starts Wrangler and Vite together. In development, the browser uses same-origin `/api/*` requests and Vite proxies them to the local Worker automatically.

See [docs/cloudflare-dynamic-workers.md](/Volumes/TiSSD/git/npmjs.dev/docs/cloudflare-dynamic-workers.md) for the design notes, tradeoffs, and rollout details.

## License

MIT
