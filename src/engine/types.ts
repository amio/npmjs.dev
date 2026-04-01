export interface LogEntry {
  type: 'log' | 'error' | 'warn' | 'info'
  content: string
  timestamp: number
}

export interface ExecutionResult {
  logs: LogEntry[]
  returnValue?: string
  error?: string
}

export interface ExecutionEngine {
  initialize(): Promise<void>
  execute(code: string): Promise<ExecutionResult>
  isReady(): boolean
  dispose(): void
  getUnavailableReason?(): string | undefined
}

export interface ExecutorAvailability {
  ready: boolean
  reason?: string
}

export type ExecutorType = 'quickjs' | 'browser'
