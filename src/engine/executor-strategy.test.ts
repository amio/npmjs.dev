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
    worker: { ready: true },
    browser: { ready: true },
    ...overrides,
  }) satisfies Record<ExecutorType, ExecutorAvailability>

describe('executor selection strategy', () => {
  test('prefers the browser sandbox when browser globals are referenced', () => {
    const selection = selectAutoExecutor('console.log(window.location.href)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'worker', 'quickjs'])
    assert.match(selection.reason, /browser APIs/i)
  })

  test('prefers the browser sandbox for browser-first package imports', () => {
    const selection = selectAutoExecutor("import React from 'react'\nconsole.log(React)", createAvailability())

    assert.deepStrictEqual(selection.plan, ['browser', 'worker', 'quickjs'])
  })

  test('prefers the worker sandbox for node builtins', () => {
    const selection = selectAutoExecutor("import path from 'node:path'\nconsole.log(path.sep)", createAvailability())

    assert.deepStrictEqual(selection.plan, ['worker', 'quickjs', 'browser'])
    assert.match(selection.reason, /node/i)
  })

  test('prefers the worker sandbox when process or Buffer globals are referenced', () => {
    const selection = selectAutoExecutor('console.log(process.env.NODE_ENV, Buffer.from("ok"))', createAvailability())

    assert.deepStrictEqual(selection.plan, ['worker', 'quickjs', 'browser'])
  })

  test('prefers QuickJS for npm imports without browser signals', () => {
    const selection = selectAutoExecutor("import { z } from 'zod'\nconsole.log(z.string())", createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'worker', 'browser'])
    assert.match(selection.reason, /npm imports/i)
  })

  test('prefers QuickJS for lightweight scripts', () => {
    const selection = selectAutoExecutor('const answer = 40 + 2\nconsole.log(answer)', createAvailability())

    assert.deepStrictEqual(selection.plan, ['quickjs', 'worker', 'browser'])
  })

  test('filters out unavailable executors from the plan', () => {
    const selection = selectAutoExecutor(
      "import path from 'node:path'",
      createAvailability({ worker: { ready: false }, browser: { ready: false } })
    )

    assert.deepStrictEqual(selection.plan, ['quickjs'])
  })

  test('falls back to the worker sandbox for missing Node globals', () => {
    const fallback = chooseFallbackExecutor('quickjs', 'ReferenceError: process is not defined', [
      'worker',
      'browser',
    ])

    assert.strictEqual(fallback, 'worker')
  })

  test('falls back to the browser sandbox for missing DOM globals', () => {
    const fallback = chooseFallbackExecutor('quickjs', 'ReferenceError: window is not defined', [
      'worker',
      'browser',
    ])

    assert.strictEqual(fallback, 'browser')
  })

  test('falls back to the worker sandbox for module resolution issues in QuickJS', () => {
    const fallback = chooseFallbackExecutor(
      'quickjs',
      'Error loading module node:path: Failed to fetch https://esm.sh/node:path',
      ['worker', 'browser']
    )

    assert.strictEqual(fallback, 'worker')
  })

  test('does not fall back for normal user-code errors', () => {
    const fallback = chooseFallbackExecutor('browser', 'TypeError: Cannot read properties of undefined', [
      'worker',
      'quickjs',
    ])

    assert.strictEqual(fallback, undefined)
  })

  test('exposes user-facing labels for each executor', () => {
    assert.strictEqual(EXECUTOR_DESCRIPTORS.quickjs.label, 'QuickJS')
    assert.strictEqual(EXECUTOR_DESCRIPTORS.worker.label, 'Worker Sandbox')
    assert.strictEqual(EXECUTOR_DESCRIPTORS.browser.label, 'Browser Sandbox')
  })
})
