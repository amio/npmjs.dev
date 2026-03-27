import { test, describe } from 'node:test'
import assert from 'node:assert'
import { CloudflareExecutorEngine } from './cloudflare-executor'

describe('CloudflareExecutorEngine', () => {
  test('should initialize correctly', async () => {
    const engine = new CloudflareExecutorEngine()
    await engine.initialize()
    assert.strictEqual(engine.isReady(), true)
  })

  test('should execute code via fetch', async () => {
    // Mock global fetch
    const originalFetch = global.fetch
    const mockLogs = [{ type: 'log', content: 'hello', timestamp: 123 }]

    global.fetch = (async (url: string, options: any) => {
      assert.strictEqual(url, '/api/execute')
      assert.strictEqual(options.method, 'POST')
      const body = JSON.parse(options.body)
      assert.strictEqual(body.code, 'console.log("hello")')

      return {
        ok: true,
        json: async () => ({
          logs: mockLogs,
          returnValue: '"success"'
        })
      } as any
    }) as any

    try {
      const engine = new CloudflareExecutorEngine()
      await engine.initialize()
      const result = await engine.execute('console.log("hello")')

      assert.deepStrictEqual(result.logs, mockLogs)
      assert.strictEqual(result.returnValue, '"success"')
      assert.strictEqual(result.error, undefined)
    } finally {
      global.fetch = originalFetch
    }
  })

  test('should handle errors from backend', async () => {
    const originalFetch = global.fetch

    global.fetch = (async () => {
      return {
        ok: true,
        json: async () => ({
          logs: [],
          error: 'Syntax Error'
        })
      } as any
    }) as any

    try {
      const engine = new CloudflareExecutorEngine()
      await engine.initialize()
      const result = await engine.execute('invalid code')

      assert.strictEqual(result.error, 'Syntax Error')
    } finally {
      global.fetch = originalFetch
    }
  })

  test('should handle fetch failures', async () => {
    const originalFetch = global.fetch

    global.fetch = (async () => {
      return {
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      } as any
    }) as any

    try {
      const engine = new CloudflareExecutorEngine()
      await engine.initialize()
      const result = await engine.execute('code')

      assert.match(result.error!, /Failed to execute on Cloudflare: 500/)
    } finally {
      global.fetch = originalFetch
    }
  })
})
