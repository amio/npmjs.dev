import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert'
import { CloudflareExecutorEngine } from './cloudflare-executor'
import {
  CLOUDFLARE_EXECUTOR_ENGINE_NAME,
  CLOUDFLARE_EXECUTOR_HEALTH_PATH,
  CLOUDFLARE_EXECUTOR_RUN_PATH,
} from './cloudflare-api'

describe('CloudflareExecutorEngine', () => {
  const originalFetch = globalThis.fetch

  beforeEach(() => {
    globalThis.fetch = originalFetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('reports unavailable when no API base is configured', async () => {
    const executor = new CloudflareExecutorEngine({ apiBase: undefined })

    const result = await executor.execute('console.log("hello")')

    assert.match(result.error || '', /Cloudflare engine is not configured/)
    assert.strictEqual(executor.isReady(), false)
  })

  test('becomes ready after a successful health check', async () => {
    globalThis.fetch = async input => {
      assert.strictEqual(String(input), `https://executor.example.com${CLOUDFLARE_EXECUTOR_HEALTH_PATH}`)

      return new Response(
        JSON.stringify({
          ok: true,
          available: true,
          engine: CLOUDFLARE_EXECUTOR_ENGINE_NAME,
          capabilities: {
            bundler: '@cloudflare/worker-bundler',
            dynamicWorkers: true,
            globalOutbound: 'blocked',
            maxCodeSizeBytes: 1024,
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const executor = new CloudflareExecutorEngine({ apiBase: 'https://executor.example.com' })
    await executor.initialize()

    assert.strictEqual(executor.isReady(), true)
    assert.strictEqual(executor.getUnavailableReason(), undefined)
  })

  test('posts code to the Cloudflare execution endpoint', async () => {
    const requests: string[] = []

    globalThis.fetch = async (input, init) => {
      requests.push(String(input))

      if (String(input).endsWith(CLOUDFLARE_EXECUTOR_HEALTH_PATH)) {
        return new Response(
          JSON.stringify({
            ok: true,
            available: true,
            engine: CLOUDFLARE_EXECUTOR_ENGINE_NAME,
            capabilities: {
              bundler: '@cloudflare/worker-bundler',
              dynamicWorkers: true,
              globalOutbound: 'blocked',
              maxCodeSizeBytes: 1024,
            },
          }),
          {
            headers: { 'Content-Type': 'application/json' },
          }
        )
      }

      assert.strictEqual(String(input), `https://executor.example.com${CLOUDFLARE_EXECUTOR_RUN_PATH}`)
      assert.strictEqual(init?.method, 'POST')
      assert.deepStrictEqual(JSON.parse(String(init?.body)), {
        code: 'console.log("hello from cloudflare")',
      })

      return new Response(
        JSON.stringify({
          ok: true,
          logs: [{ type: 'log', content: 'hello from cloudflare', timestamp: 1 }],
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const executor = new CloudflareExecutorEngine({ apiBase: 'https://executor.example.com' })
    await executor.initialize()
    const result = await executor.execute('console.log("hello from cloudflare")')

    assert.strictEqual(requests.length, 2)
    assert.deepStrictEqual(result.logs, [{ type: 'log', content: 'hello from cloudflare', timestamp: 1 }])
    assert.strictEqual(result.error, undefined)
  })
})
