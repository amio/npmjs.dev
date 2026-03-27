import { describe, test } from 'node:test'
import assert from 'node:assert'
import {
  buildCorsHeaders,
  createBundlerWarningLogs,
  createVirtualWorkerFiles,
  deriveRuntimeDependencies,
  getConfiguredAllowedOrigins,
  isCodeWithinLimit,
  resolveAllowedOrigin,
} from './runtime'

describe('cloudflare worker runtime helpers', () => {
  test('parses allowed origins from environment config', () => {
    assert.deepStrictEqual(getConfiguredAllowedOrigins('https://a.test, https://b.test '), [
      'https://a.test',
      'https://b.test',
    ])
  })

  test('allows same-origin requests by default', () => {
    const request = new Request('https://npmjs.dev/api/execute/cloudflare', {
      headers: {
        Origin: 'https://npmjs.dev',
      },
    })

    assert.strictEqual(resolveAllowedOrigin(request), 'https://npmjs.dev')
  })

  test('automatically allows loopback origins during local development', () => {
    const request = new Request('http://127.0.0.1:8787/api/execute/cloudflare', {
      headers: {
        Origin: 'http://localhost:5175',
      },
    })

    assert.strictEqual(resolveAllowedOrigin(request), 'http://localhost:5175')
  })

  test('allows wildcard subdomain origins for preview deployments', () => {
    const request = new Request('https://npmjs-dev.amio.workers.dev/api/engines/cloudflare', {
      headers: {
        Origin: 'https://npmjs-dev-amio-amio.vercel.app',
      },
    })

    assert.strictEqual(
      resolveAllowedOrigin(request, 'https://npmjs.dev, https://*.vercel.app'),
      'https://npmjs-dev-amio-amio.vercel.app'
    )
  })

  test('does not allow sibling domains outside the wildcard suffix', () => {
    const request = new Request('https://npmjs-dev.amio.workers.dev/api/engines/cloudflare', {
      headers: {
        Origin: 'https://npmjs-dev-amio-amio.example.com',
      },
    })

    assert.strictEqual(resolveAllowedOrigin(request, 'https://npmjs.dev, https://*.vercel.app'), undefined)
  })

  test('creates a virtual project for the worker bundler', () => {
    const files = createVirtualWorkerFiles('import lodash from "lodash"\nconsole.log(lodash.VERSION)\n')
    const packageJson = JSON.parse(files['package.json'])

    assert.ok(files['package.json'])
    assert.ok(files['src/index.ts'].includes('await import("./user-code.tsx")'))
    assert.ok(files['src/user-code.tsx'].includes('lodash.VERSION'))
    assert.deepStrictEqual(packageJson.dependencies, { lodash: 'latest' })
  })

  test('derives package dependencies from bare imports and subpath imports', () => {
    const dependencies = deriveRuntimeDependencies(`
      import lodash from 'lodash'
      import debounce from 'lodash/debounce'
      import { transform } from '@babel/core'
      import React from 'https://esm.sh/react'
      import './local-file'
    `)

    assert.deepStrictEqual(dependencies, {
      '@babel/core': 'latest',
      lodash: 'latest',
    })
  })

  test('converts bundler warnings into output logs', () => {
    const logs = createBundlerWarningLogs(['Missing optional dependency'])

    assert.deepStrictEqual(logs[0]?.type, 'warn')
    assert.match(logs[0]?.content || '', /Missing optional dependency/)
  })

  test('builds CORS headers only when an origin is available', () => {
    assert.deepStrictEqual(buildCorsHeaders(undefined), {})
    assert.strictEqual(buildCorsHeaders('https://npmjs.dev')['Access-Control-Allow-Origin'], 'https://npmjs.dev')
  })

  test('enforces the code size guardrail', () => {
    assert.strictEqual(isCodeWithinLimit('console.log("ok")', 1024), true)
    assert.strictEqual(isCodeWithinLimit('x'.repeat(8), 2), false)
  })
})
