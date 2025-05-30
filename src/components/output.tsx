import React from 'react'
import { LogEntry } from '../engine/js-executor-engine'

export interface OutputDisplayProps {
  logs: LogEntry[]
  error?: string
  isLoading: boolean
}

export const Output: React.FC<OutputDisplayProps> = ({ logs, error, isLoading }) => {
  const hasContent = logs.length > 0 || error

  // Safely convert error to string for display
  const formatError = (error: any): string => {
    if (typeof error === 'string') {
      return error
    }
    if (typeof error === 'object' && error !== null) {
      // If it's an Error object or similar, try to get meaningful info
      if (error.stack) {
        return error.stack
      }
      if (error.message) {
        return error.message
      }
      // Otherwise stringify the object
      try {
        return JSON.stringify(error, null, 2)
      } catch {
        return String(error)
      }
    }
    return String(error)
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

  // Get a summary (first line) of log content
  const getLogSummary = (content: any): string => {
    const fullContent = formatLogContent(content)
    const firstLine = fullContent.split('\n')[0]
    return firstLine.length > 80 ? firstLine.substring(0, 80) + '...' : firstLine
  }

  return (
    <div className="output-panel">
      {error && (
        <div className="error-output">
          <h4>❌ Error Message</h4>
          <pre>{formatError(error)}</pre>
        </div>
      )}

      {!error && logs.length > 0 && (
        <div className="console-output">
          {logs.map((log, index) => (
            <div key={`${log.timestamp}-${index}`} className={`log-entry log-${log.type}`}>
              <details className="log-details">
                <summary className="log-summary">{getLogSummary(log.content)}</summary>
                <div className="log-content">
                  <pre>{formatLogContent(log.content)}</pre>
                </div>
              </details>
            </div>
          ))}
        </div>
      )}

      {!hasContent && !isLoading && (
        <div className="placeholder">
          <small>Supports console.log output display</small>
        </div>
      )}

      {isLoading && (
        <div className="loading">
          <div className="spinner"></div>
          Executing code...
        </div>
      )}
    </div>
  )
}
