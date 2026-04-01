import { ExecutorAvailability, ExecutorType, LogEntry } from './types'
import { parseModuleDeps } from './utils'

export const EXECUTOR_ORDER: ExecutorType[] = ['quickjs', 'browser']

export interface ExecutorDescriptor {
  label: string
  summary: string
  hint: string
}

export const EXECUTOR_DESCRIPTORS: Record<ExecutorType, ExecutorDescriptor> = {
  quickjs: {
    label: 'QuickJS',
    summary: 'Runs in a QuickJS WASM VM with npm support via esm.sh.',
    hint: 'Instant startup.',
  },
  browser: {
    label: 'Browser Sandbox',
    summary: 'Runs inside a real browser iframe with DOM APIs and import maps.',
    hint: 'Best for browser-first packages.',
  },
}

interface AutoExecutorSelection {
  plan: ExecutorType[]
  reason: string
}

const BROWSER_GLOBAL_PATTERN =
  /\b(window|document|navigator|location|history|localStorage|sessionStorage|requestAnimationFrame|cancelAnimationFrame|customElements|HTMLElement|HTMLCanvasElement|MutationObserver|ResizeObserver)\b/

const NODE_ONLY_PATTERN =
  /\b(process\.stdin|process\.stdout|process\.stderr|Buffer\b|__dirname\b|__filename\b|require\s*\(|module\.exports\b)\b/

const MODULE_RESOLUTION_ERROR_PATTERN =
  /(failed to fetch|error loading module|could not resolve|failed to resolve|cannot find module|module .* not found|does not provide an export|no matching export|relative references must start with|failed to resolve module specifier|dynamically imported module)/i

const BROWSER_ENVIRONMENT_ERROR_PATTERN =
  /(window is not defined|document is not defined|navigator is not defined|HTMLElement is not defined|customElements is not defined|localStorage is not defined|sessionStorage is not defined|MutationObserver is not defined|ResizeObserver is not defined)/i

const KNOWN_BROWSER_PACKAGES = [
  'react',
  'react-dom',
  'preact',
  'vue',
  'svelte',
  'lit',
  'solid-js',
  '@radix-ui',
  '@headlessui',
  '@emotion',
  'framer-motion',
  '@mui',
  '@chakra-ui',
]

const isExternalModule = (moduleName: string): boolean =>
  !moduleName.startsWith('./') &&
  !moduleName.startsWith('../') &&
  !moduleName.startsWith('/') &&
  !moduleName.startsWith('http://') &&
  !moduleName.startsWith('https://')

const getExternalModules = (code: string): string[] => parseModuleDeps(code).filter(isExternalModule)

const hasKnownBrowserPackage = (moduleNames: string[]): boolean =>
  moduleNames.some(moduleName => KNOWN_BROWSER_PACKAGES.some(prefix => moduleName === prefix || moduleName.startsWith(`${prefix}/`)))

const hasNodeOnlySignals = (code: string, moduleNames: string[]): boolean =>
  NODE_ONLY_PATTERN.test(code) ||
  moduleNames.some(moduleName => moduleName.startsWith('node:')) ||
  moduleNames.some(moduleName =>
    ['fs', 'path', 'net', 'tls', 'child_process', 'worker_threads', 'cluster', 'readline'].includes(moduleName)
  )

const uniqueAvailableExecutors = (
  availability: Record<ExecutorType, ExecutorAvailability>,
  executors: ExecutorType[]
): ExecutorType[] => executors.filter((type, index) => availability[type]?.ready && executors.indexOf(type) === index)

export const selectAutoExecutor = (
  code: string,
  availability: Record<ExecutorType, ExecutorAvailability>
): AutoExecutorSelection => {
  const moduleNames = getExternalModules(code)
  const hasBrowserSignals = BROWSER_GLOBAL_PATTERN.test(code) || hasKnownBrowserPackage(moduleNames)
  const hasExternalModules = moduleNames.length > 0
  const hasNodeSignals = hasNodeOnlySignals(code, moduleNames)

  let preferredExecutors: ExecutorType[]
  let reason: string

  if (hasBrowserSignals) {
    preferredExecutors = ['browser', 'quickjs']
    reason = 'browser APIs or browser-first packages were detected.'
  } else if (hasExternalModules) {
    preferredExecutors = ['quickjs', 'browser']
    reason = 'npm imports were detected. Running locally via esm.sh first.'
  } else if (hasNodeSignals) {
    preferredExecutors = ['quickjs', 'browser']
    reason = 'Node.js-specific APIs were detected, so the local sandboxes will try their closest-compatible runtime first.'
  } else {
    preferredExecutors = ['quickjs', 'browser']
    reason = 'the script looks lightweight, so the fastest VM is preferred.'
  }

  const plan = uniqueAvailableExecutors(availability, preferredExecutors)

  return {
    plan,
    reason,
  }
}

export const chooseFallbackExecutor = (
  attemptedExecutor: ExecutorType,
  error: string | undefined,
  remainingExecutors: ExecutorType[]
): ExecutorType | undefined => {
  if (!error) {
    return undefined
  }

  if (BROWSER_ENVIRONMENT_ERROR_PATTERN.test(error)) {
    return remainingExecutors.find(executor => executor === 'browser')
  }

  if (MODULE_RESOLUTION_ERROR_PATTERN.test(error)) {
    if (attemptedExecutor === 'browser') {
      return remainingExecutors.find(executor => executor === 'quickjs')
    }

    if (attemptedExecutor === 'quickjs') {
      return remainingExecutors.find(executor => executor === 'browser')
    }
  }

  return undefined
}

export const createExecutorInfoLog = (content: string): LogEntry => ({
  type: 'info',
  content,
  timestamp: Date.now(),
})
