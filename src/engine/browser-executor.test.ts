import { test, describe } from 'node:test'
import assert from 'node:assert'
import { BrowserExecutorEngine } from './browser-executor'

describe('BrowserExecutorEngine', () => {
  test('should add packages to import map', () => {
    const executor = new BrowserExecutorEngine()
    executor.addPackage('lodash')
    executor.addPackage('@babel/core', '7.0.0')

    // Access private method for testing
    const importMap = JSON.parse((executor as any).generateImportMap())

    assert.strictEqual(importMap.imports.lodash, 'https://esm.sh/lodash')
    assert.strictEqual(importMap.imports['lodash/'], 'https://esm.sh/lodash/')
    assert.strictEqual(importMap.imports['@babel/core'], 'https://esm.sh/@babel/core@7.0.0')
  })

  test('should parse import statements and add packages', () => {
    const executor = new BrowserExecutorEngine()
    const code = `
      import _ from 'lodash'
      import { debounce } from 'lodash/debounce'
      import babel from '@babel/core'
      import React from 'react'
      import './local-file'
      import 'https://cdn.example.com/lib.js'
    `

    // Access private method for testing
    ;(executor as any).parseAndAddImports(code)
    const importMap = JSON.parse((executor as any).generateImportMap())

    // Should add lodash and its submodule
    assert.strictEqual(importMap.imports.lodash, 'https://esm.sh/lodash')
    assert.strictEqual(importMap.imports['lodash/debounce'], 'https://esm.sh/lodash/debounce')

    // Should add scoped package
    assert.strictEqual(importMap.imports['@babel/core'], 'https://esm.sh/@babel/core')

    // React should now be dynamically added since there are no defaults
    assert.strictEqual(importMap.imports.react, 'https://esm.sh/react')

    // Should not add relative imports or URLs
    assert(!importMap.imports['./local-file'])
    assert(!importMap.imports['https://cdn.example.com/lib.js'])
  })

  test('should set packages from URL array', () => {
    const executor = new BrowserExecutorEngine()
    executor.setPackagesFromUrl(['lodash', '@types/node', 'express'])

    const importMap = JSON.parse((executor as any).generateImportMap())

    assert.strictEqual(importMap.imports.lodash, 'https://esm.sh/lodash')
    assert.strictEqual(importMap.imports['@types/node'], 'https://esm.sh/@types/node')
    assert.strictEqual(importMap.imports.express, 'https://esm.sh/express')
  })

  test('should clear packages', () => {
    const executor = new BrowserExecutorEngine()
    executor.addPackage('lodash')
    executor.clearPackages()

    const importMap = JSON.parse((executor as any).generateImportMap())

    // Should not have lodash anymore, and no default packages
    assert(!importMap.imports.lodash)
    assert(!importMap.imports.react)
  })
})
