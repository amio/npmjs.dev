import {
  CLOUDFLARE_EXECUTOR_COMPATIBILITY_DATE,
  CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES,
} from '../engine/cloudflare-api'
import { LogEntry } from '../engine/types'
import { parseModuleDeps } from '../engine/utils'

const PACKAGE_JSON_PATH = 'package.json'
const RUNNER_MODULE_PATH = 'src/index.ts'
const USER_MODULE_PATH = 'src/user-code.tsx'

export interface DynamicWorkerDefinition {
  compatibilityDate: string
  compatibilityFlags?: string[]
  mainModule: string
  modules: Record<string, string | object>
  globalOutbound: null
}

export interface DynamicWorkerEntrypoint {
  fetch(request: Request): Promise<Response>
}

export interface DynamicWorkerInstance {
  getEntrypoint(name?: string): DynamicWorkerEntrypoint
}

export interface WorkerLoaderBinding {
  load(code: DynamicWorkerDefinition): DynamicWorkerInstance
}

export interface CloudflareExecutorHostEnv {
  LOADER: WorkerLoaderBinding
  ALLOWED_ORIGINS?: string
  RUNNER_SHARED_SECRET?: string
}

const EXECUTION_REQUEST_ORIGIN_HEADER = 'Origin'
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1'])

const serializeBundlerWarning = (warning: string): LogEntry => ({
  type: 'warn',
  content: `[bundler] ${warning}`,
  timestamp: Date.now(),
})

export const createBundlerWarningLogs = (warnings: string[] = []): LogEntry[] =>
  warnings.filter(Boolean).map(serializeBundlerWarning)

export const getConfiguredAllowedOrigins = (configuredOrigins?: string): string[] =>
  configuredOrigins
    ?.split(',')
    .map(origin => origin.trim())
    .filter(Boolean) || []

export const hasValidRunnerSecret = (request: Request, configuredSecret?: string): boolean => {
  const normalizedSecret = configuredSecret?.trim()
  if (!normalizedSecret) {
    return false
  }

  const authorizationHeader = request.headers.get('Authorization')
  if (authorizationHeader === `Bearer ${normalizedSecret}`) {
    return true
  }

  return request.headers.get('X-Runner-Secret') === normalizedSecret
}

const matchesAllowedOriginPattern = (requestOrigin: string, allowedOriginPattern: string): boolean => {
  if (requestOrigin === allowedOriginPattern) {
    return true
  }

  if (!allowedOriginPattern.includes('*')) {
    return false
  }

  try {
    const requestUrl = new URL(requestOrigin)
    const allowedUrl = new URL(allowedOriginPattern)
    const requestHostname = requestUrl.hostname
    const allowedHostname = allowedUrl.hostname

    if (requestUrl.protocol !== allowedUrl.protocol || requestUrl.port !== allowedUrl.port) {
      return false
    }

    if (!allowedHostname.startsWith('*.')) {
      return false
    }

    const hostnameSuffix = allowedHostname.slice(1)
    return requestHostname.endsWith(hostnameSuffix) && requestHostname.length > hostnameSuffix.length
  } catch {
    return false
  }
}

const isLoopbackOrigin = (origin: string): boolean => {
  try {
    return LOOPBACK_HOSTS.has(new URL(origin).hostname)
  } catch {
    return false
  }
}

export const resolveAllowedOrigin = (request: Request, configuredOrigins?: string): string | undefined => {
  const requestOrigin = request.headers.get(EXECUTION_REQUEST_ORIGIN_HEADER)
  if (!requestOrigin) {
    return undefined
  }

  if (isLoopbackOrigin(requestOrigin) && LOOPBACK_HOSTS.has(new URL(request.url).hostname)) {
    return requestOrigin
  }

  const allowedOrigins = getConfiguredAllowedOrigins(configuredOrigins)
  const defaultOrigin = new URL(request.url).origin
  const originAllowList = allowedOrigins.length > 0 ? allowedOrigins : [defaultOrigin]

  return originAllowList.some(allowedOrigin => matchesAllowedOriginPattern(requestOrigin, allowedOrigin))
    ? requestOrigin
    : undefined
}

export const buildCorsHeaders = (allowedOrigin?: string): Record<string, string> =>
  allowedOrigin
    ? {
        'Access-Control-Allow-Origin': allowedOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        Vary: 'Origin',
      }
    : {}

export const createCorsPreflightResponse = (request: Request, configuredOrigins?: string): Response => {
  const allowedOrigin = resolveAllowedOrigin(request, configuredOrigins)
  if (!allowedOrigin) {
    return new Response('Origin is not allowed', { status: 403 })
  }

  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(allowedOrigin),
  })
}

export const isCodeWithinLimit = (
  code: string,
  maxCodeSizeBytes: number = CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES
): boolean => new TextEncoder().encode(code).length <= maxCodeSizeBytes

const isBareModuleSpecifier = (moduleName: string): boolean =>
  !moduleName.startsWith('./') &&
  !moduleName.startsWith('../') &&
  !moduleName.startsWith('/') &&
  !moduleName.startsWith('http://') &&
  !moduleName.startsWith('https://')

const toDependencyName = (moduleName: string): string => {
  if (moduleName.startsWith('@')) {
    const [scope, packageName] = moduleName.split('/')
    return packageName ? `${scope}/${packageName}` : moduleName
  }

  return moduleName.split('/')[0]
}

export const deriveRuntimeDependencies = (code: string): Record<string, string> =>
  Object.fromEntries(
    Array.from(new Set(parseModuleDeps(code).filter(isBareModuleSpecifier).map(toDependencyName).filter(Boolean)))
      .sort()
      .map(dependencyName => [dependencyName, 'latest'])
  )

export const createVirtualWorkerFiles = (code: string): Record<string, string> => ({
  [PACKAGE_JSON_PATH]: JSON.stringify(
    {
      name: 'npmjs-dev-cloudflare-executor',
      private: true,
      type: 'module',
      main: RUNNER_MODULE_PATH,
      dependencies: deriveRuntimeDependencies(code),
    },
    null,
    2
  ),
  [RUNNER_MODULE_PATH]: createExecutionEntrypointModule(),
  [USER_MODULE_PATH]: code,
})

const createExecutionEntrypointModule = (): string => `
const executionLogs = [];

function serializeValue(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (value instanceof Error) {
    return value.stack || \`\${value.name}: \${value.message}\`;
  }

  if (typeof value === 'undefined') {
    return 'undefined';
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function normalizeError(error) {
  if (error instanceof Error) {
    return error.stack || \`\${error.name}: \${error.message}\`;
  }

  try {
    return JSON.stringify(error, null, 2);
  } catch {
    return String(error);
  }
}

function captureConsole() {
  const originalConsole = {
    log: console.log,
    error: console.error,
    warn: console.warn,
    info: console.info,
  };

  const createConsoleMethod = (type) => (...args) => {
    executionLogs.push({
      type,
      content: args.map(serializeValue).join(' '),
      timestamp: Date.now(),
    });
  };

  console.log = createConsoleMethod('log');
  console.error = createConsoleMethod('error');
  console.warn = createConsoleMethod('warn');
  console.info = createConsoleMethod('info');

  return () => {
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    console.info = originalConsole.info;
  };
}

export default {
  async fetch() {
    const restoreConsole = captureConsole();

    try {
      await import("./user-code.tsx");
      return Response.json({
        ok: true,
        logs: executionLogs,
      });
    } catch (error) {
      return Response.json({
        ok: false,
        logs: executionLogs,
        error: normalizeError(error),
      });
    } finally {
      restoreConsole();
    }
  },
};
`

export const normalizeExecutionError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error)

export const defaultCompatibilityDate = CLOUDFLARE_EXECUTOR_COMPATIBILITY_DATE
