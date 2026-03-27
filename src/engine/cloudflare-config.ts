interface ResolveCloudflareExecutorApiBaseOptions {
  configuredBase?: string
  isDev?: boolean
  isVercelDeployment?: boolean
  windowOrigin?: string
}

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '')

export const resolveCloudflareExecutorApiBase = ({
  configuredBase,
  isDev: _isDev = false,
  isVercelDeployment = false,
  windowOrigin,
}: ResolveCloudflareExecutorApiBaseOptions): string | undefined => {
  if (isVercelDeployment && windowOrigin) {
    return trimTrailingSlash(windowOrigin)
  }

  const normalizedConfiguredBase = configuredBase?.trim()
  if (normalizedConfiguredBase) {
    return trimTrailingSlash(normalizedConfiguredBase)
  }

  if (!windowOrigin) {
    return undefined
  }

  return trimTrailingSlash(windowOrigin)
}

export const getCloudflareExecutorApiBase = (): string | undefined => {
  const metaEnv = (import.meta as ImportMeta).env
  const windowOrigin = typeof window !== 'undefined' ? window.location.origin : undefined

  return resolveCloudflareExecutorApiBase({
    configuredBase: metaEnv?.VITE_CLOUDFLARE_EXECUTOR_API,
    isDev: Boolean(metaEnv?.DEV),
    isVercelDeployment: Boolean(metaEnv?.VITE_VERCEL_URL),
    windowOrigin,
  })
}
