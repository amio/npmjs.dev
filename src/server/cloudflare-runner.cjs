const trimTrailingSlash = value => value.replace(/\/+$/, '')

const getRunnerOrigin = () => {
  const configuredOrigin = process.env.CLOUDFLARE_RUNNER_ORIGIN?.trim()
  return configuredOrigin ? trimTrailingSlash(configuredOrigin) : undefined
}

const getRunnerSecret = () => {
  const configuredSecret = process.env.RUNNER_SHARED_SECRET?.trim()
  return configuredSecret || undefined
}

const getRunnerProxyConfig = () => {
  const origin = getRunnerOrigin()
  const secret = getRunnerSecret()

  if (!origin) {
    return {
      error: 'CLOUDFLARE_RUNNER_ORIGIN is not configured.',
    }
  }

  if (!secret) {
    return {
      error: 'RUNNER_SHARED_SECRET is not configured.',
    }
  }

  return { origin, secret }
}

const sendProxyError = (response, error) => {
  response.status(500).json({
    ok: false,
    error,
  })
}

const readProxyRequestBody = request => {
  if (request.body === undefined || request.body === null) {
    return undefined
  }

  if (typeof request.body === 'string') {
    return request.body
  }

  return JSON.stringify(request.body)
}

const buildRunnerRequestHeaders = (request, secret) => {
  const headers = {
    Authorization: `Bearer ${secret}`,
  }

  const contentType = request.headers['content-type']
  if (typeof contentType === 'string' && contentType.trim()) {
    headers['Content-Type'] = contentType
  }

  return headers
}

const sendUpstreamResponse = async (upstreamResponse, response) => {
  const body = await upstreamResponse.text()
  const contentType = upstreamResponse.headers.get('content-type')

  if (contentType) {
    response.setHeader('Content-Type', contentType)
  }

  response.status(upstreamResponse.status).send(body)
}

module.exports = {
  buildRunnerRequestHeaders,
  getRunnerProxyConfig,
  readProxyRequestBody,
  sendProxyError,
  sendUpstreamResponse,
}
