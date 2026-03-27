import {
  CLOUDFLARE_EXECUTOR_ENGINE_NAME,
  CLOUDFLARE_EXECUTOR_HEALTH_PATH,
  CLOUDFLARE_EXECUTOR_RUN_PATH,
  CloudflareExecutorHealthResponse,
  CloudflareExecutorRunRequest,
  CloudflareExecutorRunResponse,
} from './cloudflare-api'
import { getCloudflareExecutorApiBase } from './cloudflare-config'
import { ExecutionEngine, ExecutionResult } from './types'

const DEFAULT_UNAVAILABLE_REASON =
  'Cloudflare engine is not configured for this environment yet. Deploy the host Worker, or set VITE_CLOUDFLARE_EXECUTOR_API during local development.'

interface CloudflareExecutorOptions {
  apiBase?: string
}

export class CloudflareExecutorEngine implements ExecutionEngine {
  private apiBase: string | undefined
  private isInitialized = false
  private isAvailable = false
  private unavailableReason: string | undefined = DEFAULT_UNAVAILABLE_REASON

  constructor(options: CloudflareExecutorOptions = {}) {
    this.apiBase = options.apiBase
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return
    }

    this.apiBase ??= getCloudflareExecutorApiBase()

    if (!this.apiBase) {
      this.isInitialized = true
      this.isAvailable = false
      return
    }

    try {
      const response = await fetch(`${this.apiBase}${CLOUDFLARE_EXECUTOR_HEALTH_PATH}`)

      if (!response.ok) {
        throw new Error(`Health check failed with ${response.status}`)
      }

      const payload = (await response.json()) as CloudflareExecutorHealthResponse

      if (!payload.available || payload.engine !== CLOUDFLARE_EXECUTOR_ENGINE_NAME) {
        throw new Error('Cloudflare engine is not available on this host')
      }

      this.isAvailable = true
      this.unavailableReason = undefined
    } catch (error) {
      this.isAvailable = false
      this.unavailableReason = error instanceof Error ? error.message : String(error)
    } finally {
      this.isInitialized = true
    }
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.isInitialized) {
      await this.initialize()
    }

    if (!this.apiBase || !this.isAvailable) {
      return {
        logs: [],
        error: this.unavailableReason,
      }
    }

    try {
      const response = await fetch(`${this.apiBase}${CLOUDFLARE_EXECUTOR_RUN_PATH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          code,
        } satisfies CloudflareExecutorRunRequest),
      })

      const payload = (await response.json()) as CloudflareExecutorRunResponse | { error?: string }

      if (!response.ok) {
        return {
          logs: [],
          error: payload.error || `Cloudflare execution failed with ${response.status}`,
        }
      }

      return {
        logs: payload.logs || [],
        returnValue: payload.returnValue,
        error: payload.error,
      }
    } catch (error) {
      return {
        logs: [],
        error: `Cloudflare execution error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  isReady(): boolean {
    return this.isInitialized && this.isAvailable && Boolean(this.apiBase)
  }

  getUnavailableReason(): string | undefined {
    return this.isReady() ? undefined : this.unavailableReason
  }

  dispose(): void {
    this.isInitialized = false
    this.isAvailable = false
    this.unavailableReason = DEFAULT_UNAVAILABLE_REASON
  }
}
