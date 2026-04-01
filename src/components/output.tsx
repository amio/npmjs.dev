import React from 'react'
import { LogEntry } from '../engine/types'
import { RiErrorWarningLine } from '@remixicon/react'

export interface OutputDisplayProps {
  logs: LogEntry[]
  error?: string
  hasExecuted: boolean
  isLoading: boolean
}

export const Output: React.FC<OutputDisplayProps> = ({ logs, error, hasExecuted, isLoading }) => {
  // Safely convert error to string for display
  const formatError = (value: any): string => {
    if (typeof value === 'string') {
      return value
    }
    if (typeof value === 'object' && value !== null) {
      // If it's an Error object or similar, try to get meaningful info
      if (value.stack) {
        return value.stack
      }
      if (value.message) {
        return value.message
      }
      // Otherwise stringify the object
      try {
        return JSON.stringify(value, null, 2)
      } catch {
        return String(value)
      }
    }
    return String(value)
  }

  // Safely convert log content to string for display
  const formatLogContent = (content: any): string => {
    if (typeof content === 'string') {
      return content
    }
    if (typeof content === 'object' && content !== null) {
      try {
        return JSON.stringify(content, null, 2)
      } catch {
        return String(content)
      }
    }
    return String(content)
  }

  return (
    <div className="output-panel">
      {error && (
        <div className="error-output">
          <h4>
            <RiErrorWarningLine /> Error Message
          </h4>
          <pre>{formatError(error)}</pre>
        </div>
      )}

      {!error && logs.length > 0 && (
        <div className="console-output">
          {logs.map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className={`log-entry log-${log.type}`}>
              <pre>{formatLogContent(log.content)}</pre>
            </div>
          ))}
        </div>
      )}

      {!error && !isLoading && hasExecuted && logs.length === 0 && (
        <div className="output-empty-state placeholder">
          No output
          <small>Execution finished without console logs or errors.</small>
        </div>
      )}
    </div>
  )
}
