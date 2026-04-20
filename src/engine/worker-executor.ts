import { ExecutionResult, ExecutionStatusCallback } from './types'
import {
  addCodeDependenciesToImportMap,
  isExternalModuleSpecifier,
  resolveModuleUrl,
  toEsmShUrl,
} from './module-resolution'

const UNENV_MOCK_PROXY = 'unenv/runtime/mock/proxy-cjs'

const SUPPORTED_NODE_MODULES = [
  'async_hooks',
  'buffer',
  'crypto',
  'events',
  'fs',
  'fs/promises',
  'http',
  'https',
  'module',
  'net',
  'path',
  'process',
  'stream',
  'stream/consumers',
  'stream/promises',
  'stream/web',
  'string_decoder',
  'url',
  'util',
  'util/types',
  'os',
]

const MOCKED_NODE_MODULES = [
  'assert',
  'assert/strict',
  'child_process',
  'cluster',
  'console',
  'constants',
  'dgram',
  'diagnostics_channel',
  'dns',
  'dns/promises',
  'domain',
  'http2',
  'inspector',
  'inspector/promises',
  'path/posix',
  'path/win32',
  'perf_hooks',
  'punycode',
  'querystring',
  'readline',
  'readline/promises',
  'repl',
  'sys',
  'test/reporters',
  'timers',
  'timers/promises',
  'tls',
  'trace_events',
  'tty',
  'v8',
  'vm',
  'wasi',
  'worker_threads',
  'zlib',
]

const WORKER_ENVIRONMENT = {
  alias: {
    ...Object.fromEntries(
      SUPPORTED_NODE_MODULES.flatMap(moduleName => [
        [moduleName, `unenv/runtime/node/${moduleName}/index`],
        [`node:${moduleName}`, `unenv/runtime/node/${moduleName}/index`],
      ])
    ),
    ...Object.fromEntries(
      MOCKED_NODE_MODULES.flatMap(moduleName => [
        [moduleName, UNENV_MOCK_PROXY],
        [`node:${moduleName}`, UNENV_MOCK_PROXY],
      ])
    ),
    'buffer/index.js': 'buffer',
    'cross-fetch': 'unenv/runtime/npm/cross-fetch',
    'cross-fetch/polyfill': 'unenv/runtime/mock/empty',
    etag: 'unenv/runtime/mock/noop',
    fsevents: 'unenv/runtime/npm/fsevents',
    inherits: 'unenv/runtime/npm/inherits',
    'isomorphic-fetch': 'unenv/runtime/mock/empty',
    mime: 'unenv/runtime/npm/mime',
    'mime-db': 'unenv/runtime/npm/mime-db',
    'mime/lite': 'unenv/runtime/npm/mime',
    'node-fetch': 'unenv/runtime/npm/node-fetch',
    'node-fetch-native': 'unenv/runtime/npm/node-fetch',
    'node-fetch-native/polyfill': 'unenv/runtime/mock/empty',
    'consola': 'unenv/runtime/npm/consola',
    'debug': 'unenv/runtime/npm/debug',
    'whatwg-url': 'unenv/runtime/npm/whatwg-url',
  },
  inject: {
    process: 'unenv/runtime/polyfill/process',
    Buffer: ['buffer', 'Buffer'] as const,
  },
}

const STATIC_IMPORT_PATTERN =
  /((?:import|export)\s+(?:(?:[\w$]+\s*,\s*)?(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?|[\w$]+)\s+from\s+|(?:\{[^}]*\}|\*(?:\s+as\s+\w+)?)\s+from\s+)?)(['"`])([^'"`]+)\2/g

const DYNAMIC_IMPORT_PATTERN = /(import\s*\(\s*)(['"`])([^'"`]+)\2(\s*\))/g

export class WorkerExecutorEngine {
  private isInitialized = false
  private packageImportMap: Record<string, string> = {}
  private unavailableReason: string | undefined

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    if (typeof Worker === 'undefined') {
      this.unavailableReason = 'Worker API is not available in this environment.'
      throw new Error(this.unavailableReason)
    }

    if (typeof Blob === 'undefined' || typeof URL.createObjectURL !== 'function') {
      this.unavailableReason = 'Blob-based module workers are not available in this environment.'
      throw new Error(this.unavailableReason)
    }

    this.isInitialized = true
    this.unavailableReason = undefined
  }

  private resolveCompatibleSpecifier(specifier: string): string {
    const aliasTarget = WORKER_ENVIRONMENT.alias[specifier]

    if (aliasTarget) {
      return toEsmShUrl(aliasTarget)
    }

    if (!isExternalModuleSpecifier(specifier)) {
      return specifier
    }

    return resolveModuleUrl(this.packageImportMap, specifier)
  }

  private rewriteImportSpecifiers(code: string): string {
    const rewriteSpecifier = (specifier: string): string => {
      const resolvedSpecifier = this.resolveCompatibleSpecifier(specifier)
      return resolvedSpecifier === specifier ? specifier : resolvedSpecifier
    }

    const withStaticImportsRewritten = code.replace(STATIC_IMPORT_PATTERN, (_match, prefix, quote, specifier) => {
      return `${prefix}${quote}${rewriteSpecifier(specifier)}${quote}`
    })

    return withStaticImportsRewritten.replace(DYNAMIC_IMPORT_PATTERN, (_match, prefix, quote, specifier, suffix) => {
      return `${prefix}${quote}${rewriteSpecifier(specifier)}${quote}${suffix}`
    })
  }

  private createNodeCompatPrelude(): string {
    const lines = ['globalThis.global ??= globalThis']

    for (const [globalName, injectConfig] of Object.entries(WORKER_ENVIRONMENT.inject)) {
      if (typeof injectConfig === 'string') {
        const importName = `__worker_inject_${globalName}`
        lines.unshift(`import ${importName} from ${JSON.stringify(toEsmShUrl(injectConfig))}`)
        lines.push(`globalThis.${globalName} ??= ${importName}`)
        continue
      }

      const [moduleName, exportName] = injectConfig
      const importName = `__worker_inject_${globalName}`
      lines.unshift(
        `import { ${exportName} as ${importName} } from ${JSON.stringify(this.resolveCompatibleSpecifier(moduleName))}`
      )
      lines.push(`globalThis.${globalName} ??= ${importName}`)
    }

    lines.push('globalThis.setImmediate ??= (fn, ...args) => setTimeout(() => fn(...args), 0)')
    lines.push('globalThis.clearImmediate ??= (id) => clearTimeout(id)')
    lines.push("globalThis.__dirname ??= '/'")
    lines.push("globalThis.__filename ??= '/index.js'")

    return `${lines.join('\n')}\n`
  }

  private async createExecutionModuleSource(code: string, onStatus?: ExecutionStatusCallback): Promise<string> {
    onStatus?.('Resolving npm imports...')
    addCodeDependenciesToImportMap(this.packageImportMap, code)

    onStatus?.('Preparing worker runtime...')
    return `${this.createNodeCompatPrelude()}\n${this.rewriteImportSpecifiers(code)}`
  }

  private createWorkerSource(moduleUrl: string): string {
    return `
const executionLogs = []

const serializeValue = value => {
  if (value === undefined) {
    return undefined
  }

  if (typeof value === 'object' && value !== null) {
    try {
      return JSON.stringify(value, null, 2)
    } catch {
      return String(value)
    }
  }

  return String(value)
}

const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info
}

const createConsoleMethod = type => (...args) => {
  executionLogs.push({
    type,
    content: args.map(arg => serializeValue(arg) ?? 'undefined').join(' '),
    timestamp: Date.now()
  })

  originalConsole[type].apply(console, args)
}

console.log = createConsoleMethod('log')
console.error = createConsoleMethod('error')
console.warn = createConsoleMethod('warn')
console.info = createConsoleMethod('info')

const reportResult = result => {
  self.postMessage({ type: 'execution-result', result })
}

const reportStatus = message => {
  self.postMessage({ type: 'execution-status', message })
}

const reportError = error => {
  reportResult({
    logs: executionLogs,
    error: error instanceof Error ? error.stack || error.message : String(error)
  })
}

self.addEventListener('error', event => {
  reportError(event.error || event.message)
})

self.addEventListener('unhandledrejection', event => {
  reportError(event.reason || 'Unhandled promise rejection')
})

;(async () => {
  try {
    reportStatus('Loading and building npm modules...')
    const module = await import(${JSON.stringify(moduleUrl)})
    reportStatus('Collecting execution result...')
    const executionResult = module.default !== undefined ? module.default : module

    reportResult({
      logs: executionLogs,
      returnValue: serializeValue(executionResult)
    })
  } catch (error) {
    reportError(error)
  } finally {
    URL.revokeObjectURL(${JSON.stringify(moduleUrl)})
    self.close()
  }
})()
`
  }

  async execute(code: string, onStatus?: ExecutionStatusCallback): Promise<ExecutionResult> {
    if (!this.isInitialized) {
      throw new Error('Execution engine is not initialized yet')
    }

    const executionModuleSource = await this.createExecutionModuleSource(code, onStatus)
    const executionModuleUrl = URL.createObjectURL(new Blob([executionModuleSource], { type: 'text/javascript' }))
    const workerSource = this.createWorkerSource(executionModuleUrl)
    const workerUrl = URL.createObjectURL(new Blob([workerSource], { type: 'text/javascript' }))

    return new Promise<ExecutionResult>((resolve, reject) => {
      const worker = new Worker(workerUrl, { type: 'module' })

      const cleanup = () => {
        worker.terminate()
        URL.revokeObjectURL(workerUrl)
      }

      const timeoutId = globalThis.setTimeout(() => {
        cleanup()
        reject(new Error('Execution timeout'))
      }, 30000)

      worker.addEventListener('message', event => {
        if (!event.data) {
          return
        }

        if (event.data.type === 'execution-status') {
          onStatus?.(event.data.message)
          return
        }

        if (event.data.type !== 'execution-result') {
          return
        }

        globalThis.clearTimeout(timeoutId)
        cleanup()
        resolve({
          logs: event.data.result.logs || [],
          returnValue: event.data.result.returnValue,
          error: event.data.result.error,
        })
      })

      worker.addEventListener('error', event => {
        globalThis.clearTimeout(timeoutId)
        cleanup()
        reject(event.error || new Error(event.message))
      })
    }).catch(error => ({
      logs: [],
      error: `Worker execution error: ${error instanceof Error ? error.message : String(error)}`,
    }))
  }

  isReady(): boolean {
    return this.isInitialized
  }

  getUnavailableReason(): string | undefined {
    return this.unavailableReason
  }

  dispose(): void {
    this.isInitialized = false
    this.unavailableReason = undefined
    this.packageImportMap = {}
  }
}
