const {
  buildRunnerRequestHeaders,
  getRunnerProxyConfig,
  sendProxyError,
  sendUpstreamResponse,
} = require('../../src/server/cloudflare-runner.cjs')

const CLOUDFLARE_EXECUTOR_HEALTH_PATH = '/api/engines/cloudflare'

module.exports = async function handler(request, response) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    response.setHeader('Allow', 'GET, HEAD')
    response.status(405).json({
      ok: false,
      error: 'Method not allowed.',
    })
    return
  }

  const proxyConfig = getRunnerProxyConfig()
  if ('error' in proxyConfig) {
    sendProxyError(response, proxyConfig.error)
    return
  }

  const upstreamResponse = await fetch(`${proxyConfig.origin}${CLOUDFLARE_EXECUTOR_HEALTH_PATH}`, {
    method: request.method,
    headers: buildRunnerRequestHeaders(request, proxyConfig.secret),
  })

  await sendUpstreamResponse(upstreamResponse, response)
}
