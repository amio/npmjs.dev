import { describe, test } from 'node:test'
import assert from 'node:assert'
import { resolveCloudflareExecutorApiBase } from './cloudflare-config'

describe('resolveCloudflareExecutorApiBase', () => {
  test('prefers an explicitly configured API base', () => {
    const apiBase = resolveCloudflareExecutorApiBase({
      configuredBase: 'https://executor.example.com///',
      isDev: true,
      windowOrigin: 'https://app.example.com',
    })

    assert.strictEqual(apiBase, 'https://executor.example.com')
  })

  test('prefers the current origin on Vercel deployments so requests go through the same-origin proxy', () => {
    const apiBase = resolveCloudflareExecutorApiBase({
      configuredBase: 'https://executor.example.com///',
      isDev: false,
      isVercelDeployment: true,
      windowOrigin: 'https://npmjs-dev-amio-amio.vercel.app',
    })

    assert.strictEqual(apiBase, 'https://npmjs-dev-amio-amio.vercel.app')
  })

  test('falls back to the current origin in development so vite can proxy /api', () => {
    const apiBase = resolveCloudflareExecutorApiBase({
      isDev: true,
      windowOrigin: 'https://app.example.com',
    })

    assert.strictEqual(apiBase, 'https://app.example.com')
  })

  test('falls back to the current origin in production', () => {
    const apiBase = resolveCloudflareExecutorApiBase({
      isDev: false,
      windowOrigin: 'https://app.example.com/',
    })

    assert.strictEqual(apiBase, 'https://app.example.com')
  })
})
