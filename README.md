# npmjs.dev

A lightweight in‑browser playground to explore and run npm packages instantly—no local install required. Enter a package in the URL, edit code, run it, and view the package’s README side‑by‑side.

Checkout: [https://npmjs.dev/](https://npmjs.dev/)

Or run it locally: `npm run dev`

> This project is an independent experiment and not affiliated with npm, Inc.

## Features

- Dual execution engines:
  - QuickJS (WASM) – fast startup, sandboxed
  - Browser (iframe + import map via esm.sh)
- Automatic sample code based on URL package
- Live console capture (log / info / warn / error)
- README auto-fetch from unpkg (fallback name variants)
- Zero build step for adding packages—import and run
- Clean React + TypeScript architecture (Vite powered)

## License

MIT
