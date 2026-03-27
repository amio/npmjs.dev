import { ExecutionResult } from './types'

export const CLOUDFLARE_EXECUTOR_HEALTH_PATH = '/api/engines/cloudflare'
export const CLOUDFLARE_EXECUTOR_RUN_PATH = '/api/execute/cloudflare'
export const CLOUDFLARE_EXECUTOR_ENGINE_NAME = 'cloudflare-dynamic-workers'
export const CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES = 32 * 1024
export const CLOUDFLARE_EXECUTOR_COMPATIBILITY_DATE = '2026-03-24'

export interface CloudflareExecutorHealthResponse {
  ok: true
  available: true
  engine: typeof CLOUDFLARE_EXECUTOR_ENGINE_NAME
  capabilities: {
    bundler: '@cloudflare/worker-bundler'
    dynamicWorkers: true
    globalOutbound: 'blocked'
    maxCodeSizeBytes: number
  }
}

export interface CloudflareExecutorRunRequest {
  code: string
}

export interface CloudflareExecutorRunResponse extends ExecutionResult {
  ok: boolean
  meta?: {
    bundlerWarnings?: string[]
    compatibilityDate?: string
    globalOutbound?: 'blocked'
  }
}
