/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV?: boolean
  readonly VITE_CLOUDFLARE_EXECUTOR_API?: string
  readonly VITE_VERCEL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
