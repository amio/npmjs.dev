/// <reference types="node" />
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

  test('os module maps to unenv runtime node shim, not proxy-cjs', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import os from 'os'
      os.platform()
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/node\/os/)
    assert.doesNotMatch(source, /unenv\/runtime\/mock\/proxy/)
  })

  test('node:os prefix maps to unenv runtime node shim', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import os from 'node:os'
      os.homedir()
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/node\/os/)
  })

  test('debug npm package maps to unenv runtime npm shim', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import debug from 'debug'
      const log = debug('app')
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/npm\/debug/)
    assert.doesNotMatch(source, /from ['"`]debug['"`]/)
  })

  test('whatwg-url npm package maps to unenv runtime npm shim', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import { URL } from 'whatwg-url'
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/npm\/whatwg-url/)
  })

  test('consola npm package maps to unenv runtime npm shim', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      import consola from 'consola'
      consola.info('hello')
    `)

    assert.match(source, /https:\/\/esm\.sh\/unenv\/runtime\/npm\/consola/)
  })

  test('injects setImmediate and clearImmediate global polyfills', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      setImmediate(() => console.log('deferred'))
    `)

    assert.match(source, /globalThis\.setImmediate\s*\?\?=/)
    assert.match(source, /globalThis\.clearImmediate\s*\?\?=/)
  })

  test('injects __dirname and __filename CJS shims', async () => {
    const executor = new WorkerExecutorEngine()
    const source = await (executor as any).createExecutionModuleSource(`
      console.log(__dirname)
    `)

    assert.match(source, /globalThis\.__dirname\s*\?\?=/)
    assert.match(source, /globalThis\.__filename\s*\?\?=/)
  })
})
