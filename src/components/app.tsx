import React, { useState, useEffect, useCallback } from 'react'
import { CodeEditor } from './code-editor'
import { Output } from './output'
import { Readme } from './readme'
import { JSExecutorEngine, LogEntry } from '../engine/js-executor-engine'

const App: React.FC = () => {
  const packageName = getPackageNameFromUrl()
  const initialCode = generateExampleCode(packageName)

  const [code, setCode] = useState(initialCode)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [executor] = useState(() => new JSExecutorEngine())

  // Initialize execution engine
  useEffect(() => {
    let isMounted = true

    const initializeEngine = async () => {
      try {
        await executor.initialize()
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    initializeEngine()

    return () => {
      isMounted = false
      executor.dispose()
    }
  }, [executor])

  // Listen for URL changes and update code example
  useEffect(() => {
    const handleUrlChange = () => {
      const newPackageName = getPackageNameFromUrl()
      const newCode = generateExampleCode(newPackageName)
      setCode(newCode)
      setLogs([])
      setError(undefined)
    }

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleUrlChange)

    return () => {
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [])

  // Execute code
  const executeCode = useCallback(async () => {
    if (!executor.isReady()) {
      setError('Execution engine is not initialized yet')
      return
    }

    setIsLoading(true)
    setError(undefined)
    setLogs([])

    try {
      const result = await executor.execute(code)
      console.log('Execution result:', result)
      setLogs(result.logs)
      setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [code, executor])

  return (
    <div className="app-container">
      <div className="header-row">
        <div className="app-header width-limited">
          <h1>npmjs:dev</h1>
          <div>Run and explore NPM packages in browser</div>
        </div>
      </div>
      <div className="app-main width-limited">
        <div className="runner-column">
          <CodeEditor code={code} onChange={setCode} onExecute={executeCode} isLoading={isLoading} />
          <Output logs={logs} error={error} isLoading={isLoading} />
        </div>
        <div className="doc-column">
          <Readme package={packageName} />
        </div>
      </div>
    </div>
  )
}

// Parse package name from URL
const getPackageNameFromUrl = (): string => {
  const url = window.location.href
  const match = url.match(/\/package\/([^\/\?#]+)/)
  return match ? match[1] : 'lodash' // Default to lodash as example
}

// Generate example code based on package name
const generateExampleCode = (packageName: string): string => {
  // Convert package name to a valid variable name
  const variableName = packageName
    .replace(/[@\/\-\.]/g, '_')
    .replace(/^[0-9]/, '_$&') // Add underscore prefix if starts with number
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove other invalid characters

  return `import ${variableName} from '${packageName}'`
}

export default App
