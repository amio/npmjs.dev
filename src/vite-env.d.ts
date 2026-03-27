/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly DEV?: boolean
  readonly VITE_CLOUDFLARE_EXECUTOR_API?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
