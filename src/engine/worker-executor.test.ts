import assert from 'node:assert'
import { describe, test } from 'node:test'
import { WorkerExecutorEngine } from './worker-executor'

describe('WorkerExecutorEngine', () => {
  test('rewrites node builtins to unenv runtime modules', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import path from 'node:path'
      path.basename('/tmp/demo.txt')
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/node\/path/)
    assert.doesNotMatch(source, /from ['"`]node:path['"`]/)
  })

  test('injects Node-compatible globals before user code runs', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      console.log(process.env.NODE_ENV)
      Buffer.from('hello').toString('utf8')
    `)

    assert.match(source, /globalThis\.process\s*\?\?=/)
    assert.match(source, /globalThis\.Buffer\s*\?\?=/)
  })

  test('rewrites npm package imports to esm.sh URLs', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import { z } from 'zod'
      z.string().parse('ok')
    `)

    assert.match(source, /https:\/\/esm\.sh\/zod/)
    assert.doesNotMatch(source, /from ['"`]zod['"`]/)
  })
})
