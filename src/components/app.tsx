import React, { useState, useEffect, useCallback } from 'react'
import { CodeEditor } from './code-editor'
import { Output } from './output'
import { Readme } from './readme'
import { JSExecutorEngine } from '../engine/quickjs-executor'
import { BrowserExecutorEngine } from '../engine/browser-executor'
import { LogEntry, ExecutorType } from '../engine/types'

const App: React.FC = () => {
  const packageName = getPackageNameFromUrl(window.location.href)
  const initialCode = generateExampleCode(packageName)

  const [code, setCode] = useState(initialCode)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [executorType, setExecutorType] = useState<ExecutorType>('quickjs')
  
  const [quickjsExecutor] = useState(() => new JSExecutorEngine())
  const [browserExecutor] = useState(() => new BrowserExecutorEngine())

  const currentExecutor = executorType === 'quickjs' ? quickjsExecutor : browserExecutor

  // Initialize execution engines
  useEffect(() => {
    let isMounted = true

    const initializeEngines = async () => {
      try {
        await Promise.all([
          quickjsExecutor.initialize(),
          browserExecutor.initialize()
        ])
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err))
        }
      }
    }

    initializeEngines()

    return () => {
      isMounted = false
      quickjsExecutor.dispose()
      browserExecutor.dispose()
    }
  }, [quickjsExecutor, browserExecutor])

  // Listen for URL changes and update code example
  useEffect(() => {
    const handleUrlChange = () => {
      const newPackageName = getPackageNameFromUrl(window.location.href)
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
    if (!currentExecutor.isReady()) {
      setError('Execution engine is not initialized yet')
      return
    }

    setIsLoading(true)
    setError(undefined)
    setLogs([])

    try {
      const result = await currentExecutor.execute(code)
      console.log('Execution result:', result)
      setLogs(result.logs)
      setError(result.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [code, currentExecutor])

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
          <CodeEditor 
            code={code} 
            onChange={setCode} 
            onExecute={executeCode} 
            isLoading={isLoading}
            executorType={executorType}
            onExecutorTypeChange={setExecutorType}
          />
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
export const getPackageNameFromUrl = (url: string): string => {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `http://dummy.com${url}`)
    const pathParts = urlObj.pathname.split('/').filter(Boolean)
    
    if (pathParts.length === 0) {
      return 'lodash' // Default to lodash as example
    }
    
    // Handle scoped packages like @babel/core
    if (pathParts[0].startsWith('@') && pathParts.length > 1) {
      return `${pathParts[0]}/${pathParts[1]}`
    }
    
    // Handle regular packages
    return pathParts[0]
  } catch (e) {
    return 'lodash' // Default to lodash if URL parsing fails
  }
}

// Generate example code based on package name
export const generateExampleCode = (packageName: string): string => {
  // Clean package name by removing truly invalid characters
  // Keep valid npm package characters: letters, numbers, hyphens, underscores, periods, @ (for scoped packages and versions)
  const cleanedPackageName = packageName
    .replace(/[^a-zA-Z0-9@\/\-\._]/g, '') // Remove truly invalid characters like #$%
    .replace(/@+$/, '') // Remove trailing @ symbols
    .replace(/\/+$/, '') // Remove trailing slashes
  
  // Convert package name to a valid variable name
  const variableName = cleanedPackageName
    .replace(/[@\/\-\.]/g, '_')
    .replace(/^[0-9]/, '_$&') // Add underscore prefix if starts with number
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove other invalid characters

  return `import ${variableName} from '${cleanedPackageName}'`
}

export default App
