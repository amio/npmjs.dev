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

export type ExecutorType = 'quickjs' | 'browser'
