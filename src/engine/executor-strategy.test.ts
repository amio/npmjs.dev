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
    ...overrides,
  }) satisfies Record<ExecutorType, ExecutorAvailability>

describe('executor selection strategy', () => {
  test('prefers the browser sandbox when browser globals are referenced', () => {
    const selection = selectAutoExecutor('console.log(window.location.href)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'quickjs'])
    assert.match(selection.reason, /browser APIs/i)
  })

  test('prefers the browser sandbox for browser-first package imports', () => {
    const selection = selectAutoExecutor("import React from 'react'\nconsole.log(React)", createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'quickjs'])
  })

  test('prefers QuickJS for npm imports without browser signals', () => {
    const selection = selectAutoExecutor("import { z } from 'zod'\nconsole.log(z.string())", createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'browser'])
    assert.match(selection.reason, /npm imports/i)
  })

  test('prefers QuickJS for lightweight scripts', () => {
    const selection = selectAutoExecutor('const answer = 40 + 2\nconsole.log(answer)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'browser'])
  })

  test('filters out unavailable executors from the plan', () => {
    const selection = selectAutoExecutor("import { z } from 'zod'", createAvailability({ browser: { ready: false } }))

    assert.deepStrictEqual(selection.plan, ['quickjs'])
  })

  test('falls back to the browser sandbox for missing DOM globals', () => {
    const fallback = chooseFallbackExecutor('quickjs', 'ReferenceError: window is not defined', [
      'browser',
    ])

    assert.strictEqual(fallback, 'browser')
  })

  test('falls back to the browser sandbox for module resolution issues in QuickJS', () => {
    const fallback = chooseFallbackExecutor(
      'quickjs',
      'Error loading module react-dom: Failed to fetch https://esm.sh/react-dom',
      ['browser']
    )

    assert.strictEqual(fallback, 'browser')
  })

  test('does not fall back for normal user-code errors', () => {
    const fallback = chooseFallbackExecutor('browser', 'TypeError: Cannot read properties of undefined', ['quickjs'])

    assert.strictEqual(fallback, undefined)
  })

  test('exposes user-facing labels for each executor', () => {
    assert.strictEqual(EXECUTOR_DESCRIPTORS.quickjs.label, 'QuickJS')
    assert.strictEqual(EXECUTOR_DESCRIPTORS.browser.label, 'Browser Sandbox')
  })
})
