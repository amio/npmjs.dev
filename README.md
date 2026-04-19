# npmjs.dev

A lightweight in‑browser playground to explore and run npm packages instantly, and view the package’s README side‑by‑side.

A spiritual successor to [RunKit](https://runkit.com/), built with modern web technologies and totally running in browser. Long live the web!

Checkout: [https://npmjs.dev/](https://npmjs.dev/)

> This project is an independent experiment and not affiliated with npm, Inc.

## Features

- Two execution engines:
  - Browser Sandbox (DOM APIs + import maps via esm.sh)
  - Worker Sandbox (Node-compatible shims via unenv)
- Automatic sample code based on URL package
- Live console capture (log / info / warn / error)
- README auto-fetch from unpkg (fallback name variants)

## Development

For local development:

```sh
npm run dev
```

## License

MIT
