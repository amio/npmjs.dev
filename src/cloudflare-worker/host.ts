import { createWorker } from '@cloudflare/worker-bundler'
import {
  CLOUDFLARE_EXECUTOR_COMPATIBILITY_DATE,
  CLOUDFLARE_EXECUTOR_ENGINE_NAME,
  CLOUDFLARE_EXECUTOR_HEALTH_PATH,
  CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES,
  CLOUDFLARE_EXECUTOR_RUN_PATH,
  CloudflareExecutorHealthResponse,
  CloudflareExecutorRunRequest,
  CloudflareExecutorRunResponse,
} from '../engine/cloudflare-api'
import {
  createBundlerWarningLogs,
  buildCorsHeaders,
  CloudflareExecutorHostEnv,
  createCorsPreflightResponse,
  createVirtualWorkerFiles,
  defaultCompatibilityDate,
  hasValidRunnerSecret,
  isCodeWithinLimit,
  normalizeExecutionError,
  resolveAllowedOrigin,
} from './runtime'

const createJsonResponse = (payload: unknown, init?: ResponseInit): Response =>
  new Response(JSON.stringify(payload), {
    status: init?.status || 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(init?.headers || {}),
    },
  })

const createCorsJsonResponse = (
  payload: unknown,
  request: Request,
  env: CloudflareExecutorHostEnv,
  init?: ResponseInit
): Response =>
  createJsonResponse(payload, {
    ...init,
    headers: {
      ...buildCorsHeaders(resolveAllowedOrigin(request, env.ALLOWED_ORIGINS)),
      ...(init?.headers || {}),
    },
  })

const ensureRequestOrigin = (request: Request, env: CloudflareExecutorHostEnv): Response | undefined => {
  const allowedOrigin = resolveAllowedOrigin(request, env.ALLOWED_ORIGINS)
  if (!allowedOrigin) {
    return createJsonResponse(
      {
        ok: false,
        error:
          'Origin is not allowed. Use the same origin deployment, or configure ALLOWED_ORIGINS for local development and cross-origin hosting.',
      },
      { status: 403 }
    )
  }

  return undefined
}

const isTrustedRunnerProxyRequest = (request: Request, env: CloudflareExecutorHostEnv): boolean =>
  hasValidRunnerSecret(request, env.RUNNER_SHARED_SECRET)

const createUnauthorizedRunnerResponse = (): Response =>
  createJsonResponse(
    {
      ok: false,
      error: 'Runner authentication failed.',
    },
    { status: 401 }
  )

const createHealthResponse = (): CloudflareExecutorHealthResponse => ({
  ok: true,
  available: true,
  engine: CLOUDFLARE_EXECUTOR_ENGINE_NAME,
  capabilities: {
    bundler: '@cloudflare/worker-bundler',
    dynamicWorkers: true,
    globalOutbound: 'blocked',
    maxCodeSizeBytes: CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES,
  },
})

const executeCode = async (code: string, env: CloudflareExecutorHostEnv): Promise<CloudflareExecutorRunResponse> => {
  const { mainModule, modules, wranglerConfig, warnings } = await createWorker({
    files: createVirtualWorkerFiles(code),
    bundle: true,
    minify: false,
  })

  const worker = env.LOADER.load({
    compatibilityDate: wranglerConfig?.compatibilityDate ?? defaultCompatibilityDate,
    compatibilityFlags: wranglerConfig?.compatibilityFlags ?? [],
    mainModule,
    modules: modules as Record<string, string | object>,
    globalOutbound: null,
  })

  const response = await worker.getEntrypoint().fetch(new Request('https://dynamic-worker.internal/'))
  const bundlerWarnings = (warnings || []).map(warning => String(warning))

  let payload: CloudflareExecutorRunResponse

  try {
    payload = (await response.json()) as CloudflareExecutorRunResponse
  } catch {
    payload = {
      ok: false,
      logs: [],
      error: 'Dynamic Worker returned an invalid response payload.',
    }
  }

  return {
    ok: payload.ok,
    logs: [...createBundlerWarningLogs(bundlerWarnings), ...(payload.logs || [])],
    returnValue: payload.returnValue,
    error: payload.error,
    meta: {
      bundlerWarnings,
      compatibilityDate: wranglerConfig?.compatibilityDate ?? CLOUDFLARE_EXECUTOR_COMPATIBILITY_DATE,
      globalOutbound: 'blocked',
    },
  }
}

export default {
  async fetch(request: Request, env: CloudflareExecutorHostEnv): Promise<Response> {
    const url = new URL(request.url)
    const requiresRunnerAuth = Boolean(env.RUNNER_SHARED_SECRET?.trim())
    const isTrustedRunnerRequest = isTrustedRunnerProxyRequest(request, env)

    if (request.method === 'OPTIONS' && url.pathname === CLOUDFLARE_EXECUTOR_RUN_PATH) {
      if (requiresRunnerAuth && !isTrustedRunnerRequest) {
        return createUnauthorizedRunnerResponse()
      }

      return createCorsPreflightResponse(request, env.ALLOWED_ORIGINS)
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && url.pathname === CLOUDFLARE_EXECUTOR_HEALTH_PATH) {
      if (requiresRunnerAuth && !isTrustedRunnerRequest) {
        return createUnauthorizedRunnerResponse()
      }

      if (request.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            ...buildCorsHeaders(resolveAllowedOrigin(request, env.ALLOWED_ORIGINS)),
            'Content-Type': 'application/json; charset=utf-8',
          },
        })
      }

      return createCorsJsonResponse(createHealthResponse(), request, env)
    }

    if (request.method === 'POST' && url.pathname === CLOUDFLARE_EXECUTOR_RUN_PATH) {
      if (requiresRunnerAuth) {
        if (!isTrustedRunnerRequest) {
          return createUnauthorizedRunnerResponse()
        }
      } else {
        const blockedResponse = ensureRequestOrigin(request, env)
        if (blockedResponse) {
          return blockedResponse
        }
      }

      let payload: CloudflareExecutorRunRequest

      try {
        payload = (await request.json()) as CloudflareExecutorRunRequest
      } catch {
        return createCorsJsonResponse(
          {
            ok: false,
            error: 'Request body must be valid JSON.',
          },
          request,
          env,
          { status: 400 }
        )
      }

      if (!payload.code?.trim()) {
        return createCorsJsonResponse(
          {
            ok: false,
            error: 'Code is required.',
          },
          request,
          env,
          { status: 400 }
        )
      }

      if (!isCodeWithinLimit(payload.code)) {
        return createCorsJsonResponse(
          {
            ok: false,
            error: `Code exceeds the ${CLOUDFLARE_EXECUTOR_MAX_CODE_SIZE_BYTES} byte limit for the Cloudflare engine.`,
          },
          request,
          env,
          { status: 413 }
        )
      }

      try {
        const result = await executeCode(payload.code, env)
        return createCorsJsonResponse(result, request, env)
      } catch (error) {
        return createCorsJsonResponse(
          {
            ok: false,
            logs: [],
            error: normalizeExecutionError(error),
          },
          request,
          env,
          { status: 500 }
        )
      }
    }

    return new Response('Not found', { status: 404 })
  },
}
