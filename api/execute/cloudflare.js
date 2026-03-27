const {
  buildRunnerRequestHeaders,
  getRunnerProxyConfig,
  readProxyRequestBody,
  sendProxyError,
  sendUpstreamResponse,
} = require('../../src/server/cloudflare-runner.cjs')

const CLOUDFLARE_EXECUTOR_RUN_PATH = '/api/execute/cloudflare'

module.exports = async function handler(request, response) {
  if (request.method !== 'POST') {
    response.setHeader('Allow', 'POST')
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

  const upstreamResponse = await fetch(`${proxyConfig.origin}${CLOUDFLARE_EXECUTOR_RUN_PATH}`, {
    method: 'POST',
    headers: buildRunnerRequestHeaders(request, proxyConfig.secret),
    body: readProxyRequestBody(request),
  })

  await sendUpstreamResponse(upstreamResponse, response)
}
