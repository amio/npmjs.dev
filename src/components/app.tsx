import React, { useState, useEffect, useCallback } from 'react'
import { CodeEditor } from './code-editor'
import { Output } from './output'
import { Readme } from './readme'
import { JSExecutorEngine } from '../engine/quickjs-executor'
import { WorkerExecutorEngine } from '../engine/worker-executor'
import { BrowserExecutorEngine } from '../engine/browser-executor'
import { ExecutionEngine, ExecutorAvailability, LogEntry, ExecutorType } from '../engine/types'
import {
  chooseFallbackExecutor,
  createExecutorInfoLog,
  EXECUTOR_DESCRIPTORS,
  EXECUTOR_ORDER,
  selectAutoExecutor,
} from '../engine/executor-strategy'
import { saveCodeToStorage, loadCodeFromStorage } from '../utils/local-storage'
import { getCodeFromUrlHash, clearCodeFromUrl } from '../utils/url-code'

const createDefaultExecutorAvailability = (): Record<ExecutorType, ExecutorAvailability> => ({
  quickjs: { ready: false, reason: `${EXECUTOR_DESCRIPTORS.quickjs.label} is still initializing.` },
  worker: { ready: false, reason: `${EXECUTOR_DESCRIPTORS.worker.label} is still initializing.` },
  browser: { ready: false, reason: `${EXECUTOR_DESCRIPTORS.browser.label} is still initializing.` },
})

const App: React.FC = () => {
  const packageName = getPackageNameFromUrl(window.location.href)

  // Load saved code or use generated example
  // Priority: URL hash > localStorage > generated default
  const getInitialCode = (pkg: string): string => {
    const hashCode = getCodeFromUrlHash()
    if (hashCode) return hashCode

    const savedCode = loadCodeFromStorage(pkg)
    return savedCode || generateExampleCode(pkg)
  }

  const [code, setCode] = useState(() => getInitialCode(packageName))
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | undefined>()
  const [isLoading, setIsLoading] = useState(false)
  const [executorType, setExecutorType] = useState<ExecutorType>('quickjs')
  const [hasManualExecutorSelection, setHasManualExecutorSelection] = useState(false)
  const [executorAvailability, setExecutorAvailability] = useState<Record<ExecutorType, ExecutorAvailability>>(
    createDefaultExecutorAvailability
  )

  const [executors] = useState<Record<ExecutorType, ExecutionEngine>>(() => ({
    quickjs: new JSExecutorEngine(),
    worker: new WorkerExecutorEngine(),
    browser: new BrowserExecutorEngine(),
  }))

  const autoExecutorSelection = React.useMemo(
    () => selectAutoExecutor(code, executorAvailability),
    [code, executorAvailability]
  )

  // Initialize execution engines
  useEffect(() => {
    let isMounted = true

    const initializeEngines = async () => {
      const nextAvailability = createDefaultExecutorAvailability()

      await Promise.all(
        EXECUTOR_ORDER.map(async executorName => {
          const executor = executors[executorName]

          try {
            await executor.initialize()
          } catch (err) {
            nextAvailability[executorName] = {
              ready: false,
              reason: err instanceof Error ? err.message : String(err),
            }
            return
          }

          nextAvailability[executorName] = executor.isReady()
            ? { ready: true }
            : {
              ready: false,
              reason: executor.getUnavailableReason?.() || 'Initialization did not complete successfully.',
            }
        })
      )

      if (isMounted) {
        setExecutorAvailability(nextAvailability)
      }
    }

    initializeEngines()

    return () => {
      isMounted = false
      EXECUTOR_ORDER.forEach(executorName => {
        executors[executorName].dispose()
      })
    }
  }, [executors])

  useEffect(() => {
    if (hasManualExecutorSelection && executorAvailability[executorType]?.ready) {
      return
    }

    const fallbackExecutor = autoExecutorSelection.plan[0] || EXECUTOR_ORDER.find(type => executorAvailability[type].ready)
    if (fallbackExecutor && fallbackExecutor !== executorType) {
      setExecutorType(fallbackExecutor)
    }
  }, [autoExecutorSelection.plan, executorAvailability, executorType, hasManualExecutorSelection])

  // Save code to localStorage when it changes
  useEffect(() => {
    const generatedCode = generateExampleCode(packageName)
    // Only save if code has been modified from the default
    if (code !== generatedCode) {
      saveCodeToStorage(packageName, code)
    }
  }, [code, packageName])

  // Clear hash from URL when user starts editing (so stale shared code doesn't persist)
  const handleCodeChange = useCallback(
    (newCode: string) => {
      setCode(newCode)
      clearCodeFromUrl()
    },
    [],
  )

  // Listen for URL changes and update code example
  useEffect(() => {
    const handleUrlChange = () => {
      const newPackageName = getPackageNameFromUrl(window.location.href)
      const newCode = getInitialCode(newPackageName)
      setCode(newCode)
      setLogs([])
      setError(undefined)
      setHasManualExecutorSelection(false)
    }

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleUrlChange)

    return () => {
      window.removeEventListener('popstate', handleUrlChange)
    }
  }, [])

  // Execute code
  const executeCode = useCallback(async () => {
    const executionPlan = hasManualExecutorSelection
      ? [executorType]
      : autoExecutorSelection.plan.length > 0
        ? autoExecutorSelection.plan
        : [executorType]

    const initialExecutor = executors[executionPlan[0]]

    if (!initialExecutor?.isReady()) {
      setError(initialExecutor?.getUnavailableReason?.() || 'Execution engine is not initialized yet')
      return
    }

    setIsLoading(true)
    setError(undefined)
    setLogs([])

    try {
      const infoLogs: LogEntry[] = []
      let activeExecutorType = executionPlan[0]
      let lastResult = await executors[activeExecutorType].execute(code)

      if (!hasManualExecutorSelection) {
        let remainingExecutors = executionPlan.slice(1)

        while (lastResult.error) {
          const fallbackExecutorType = chooseFallbackExecutor(activeExecutorType, lastResult.error, remainingExecutors)
          if (!fallbackExecutorType) {
            break
          }

          infoLogs.push(
            createExecutorInfoLog(
              `${EXECUTOR_DESCRIPTORS[activeExecutorType].label} hit an environment mismatch. Retrying with ${EXECUTOR_DESCRIPTORS[fallbackExecutorType].label}.`
            )
          )

          activeExecutorType = fallbackExecutorType
          remainingExecutors = remainingExecutors.filter(type => type !== fallbackExecutorType)
          lastResult = await executors[activeExecutorType].execute(code)
        }
      }

      if (!hasManualExecutorSelection && activeExecutorType !== executorType) {
        setExecutorType(activeExecutorType)
      }

      setLogs([...infoLogs, ...lastResult.logs])
      setError(lastResult.error)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setIsLoading(false)
    }
  }, [autoExecutorSelection.plan, code, executorType, executors, hasManualExecutorSelection])

  const handleExecutorTypeChange = useCallback((type: ExecutorType) => {
    setHasManualExecutorSelection(true)
    setExecutorType(type)
  }, [])

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
            onChange={handleCodeChange}
            onExecute={executeCode}
            isLoading={isLoading}
            executorType={executorType}
            onExecutorTypeChange={handleExecutorTypeChange}
            executorAvailability={executorAvailability}
          />
          <Output logs={logs} error={error} isLoading={isLoading} />
          <footer className="app-footer">
            <a href="https://github.com/amio/npmjs.dev" target="_blank" rel="noopener noreferrer">
              npmjs.dev
            </a>{' '}
            is not affiliated with npm, Inc.
          </footer>
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
      return ''
    }

    // Handle scoped packages like @babel/core
    if (pathParts[0].startsWith('@') && pathParts.length > 1) {
      return `${pathParts[0]}/${pathParts[1]}`
    }

    // Handle regular packages
    return pathParts[0]
  } catch {
    return ''
  }
}

// Generate example code based on package name
export const generateExampleCode = (packageName: string): string => {
  if (!packageName) return ''

  // Clean package name by removing truly invalid characters
  // Keep valid npm package characters: letters, numbers, hyphens, underscores, periods, @ (for scoped packages and versions)
  const cleanedPackageName = packageName
    .replace(/[^a-zA-Z0-9@/._-]/g, '') // Remove truly invalid characters like #$%
    .replace(/@+$/, '') // Remove trailing @ symbols
    .replace(/\/+$/, '') // Remove trailing slashes

  // Convert package name to a valid variable name
  const variableName = cleanedPackageName
    .replace(/[@/.-]/g, '_')
    .replace(/^[0-9]/, '_$&') // Add underscore prefix if starts with number
    .replace(/[^a-zA-Z0-9_]/g, '') // Remove other invalid characters

  return `import * as ${variableName} from '${cleanedPackageName}'\n\nconsole.log(\n  Object.keys(${variableName})\n)`
}

export default App
