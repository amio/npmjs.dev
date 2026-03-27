import { ExecutionResult } from './types'

export class CloudflareExecutorEngine {
  private isInitialized = false
  private backendUrl = '/api/execute' // Default to relative path for proxy/deployment

  constructor(backendUrl?: string) {
    if (backendUrl) {
      this.backendUrl = backendUrl
    }
  }

  async initialize(): Promise<void> {
    // Check if the backend is reachable or just mark as initialized
    this.isInitialized = true
  }

  async execute(code: string): Promise<ExecutionResult> {
    if (!this.isInitialized) {
      throw new Error('Cloudflare execution engine is not initialized')
    }

    try {
      const response = await fetch(this.backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          logs: [],
          error: `Failed to execute on Cloudflare: ${response.status} ${errorText}`,
        }
      }

      const result = await response.json()
      return {
        logs: result.logs || [],
        returnValue: result.returnValue,
        error: result.error,
      }
    } catch (error) {
      return {
        logs: [],
        error: `Cloudflare execution error: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
  }

  isReady(): boolean {
    return this.isInitialized
  }

  dispose(): void {
    this.isInitialized = false
  }
}
