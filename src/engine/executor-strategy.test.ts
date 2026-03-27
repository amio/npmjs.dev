import assert from 'node:assert'
import { describe, test } from 'node:test'
import { ExecutorAvailability, ExecutorType } from './types'
import {
  chooseFallbackExecutor,
  EXECUTOR_DESCRIPTORS,
  selectAutoExecutor,
} from './executor-strategy'

const createAvailability = (overrides: Partial<Record<ExecutorType, ExecutorAvailability>> = {}) =>
  ({
    quickjs: { ready: true },
    browser: { ready: true },
    cloudflare: { ready: true },
    ...overrides,
  }) satisfies Record<ExecutorType, ExecutorAvailability>

describe('executor selection strategy', () => {
  test('prefers the browser sandbox when browser globals are referenced', () => {
    const selection = selectAutoExecutor('console.log(window.location.href)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'quickjs', 'cloudflare'])
    assert.match(selection.reason, /browser APIs/i)
  })

  test('prefers the browser sandbox for browser-first package imports', () => {
    const selection = selectAutoExecutor("import React from 'react'\nconsole.log(React)", createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'quickjs', 'cloudflare'])
  })

  test('prefers QuickJS for npm imports without browser signals', () => {
    const selection = selectAutoExecutor("import { z } from 'zod'\nconsole.log(z.string())", createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'browser', 'cloudflare'])
    assert.match(selection.reason, /npm imports/i)
  })

  test('prefers QuickJS for lightweight scripts', () => {
    const selection = selectAutoExecutor('const answer = 40 + 2\nconsole.log(answer)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'browser', 'cloudflare'])
  })

  test('filters out unavailable executors from the plan', () => {
    const selection = selectAutoExecutor("import { z } from 'zod'", createAvailability({ cloudflare: { ready: false } }))

    assert.deepStrictEqual(selection.plan, ['quickjs', 'browser'])
  })

  test('falls back to the browser sandbox for missing DOM globals', () => {
    const fallback = chooseFallbackExecutor('cloudflare', 'ReferenceError: window is not defined', [
      'browser',
      'quickjs',
    ])

    assert.strictEqual(fallback, 'browser')
  })

  test('falls back to the Cloudflare Worker for module resolution issues in other runners', () => {
    const fallback = chooseFallbackExecutor(
      'quickjs',
      'Error loading module react-dom: Failed to fetch https://esm.sh/react-dom',
      ['cloudflare', 'browser']
    )

    assert.strictEqual(fallback, 'cloudflare')
  })

  test('does not fall back for normal user-code errors', () => {
    const fallback = chooseFallbackExecutor('cloudflare', 'TypeError: Cannot read properties of undefined', [
      'browser',
      'quickjs',
    ])

    assert.strictEqual(fallback, undefined)
  })

  test('exposes user-facing labels for each executor', () => {
    assert.strictEqual(EXECUTOR_DESCRIPTORS.quickjs.label, 'QuickJS')
    assert.strictEqual(EXECUTOR_DESCRIPTORS.browser.label, 'Browser Sandbox')
    assert.strictEqual(EXECUTOR_DESCRIPTORS.cloudflare.label, 'Cloudflare Worker')
  })
})
