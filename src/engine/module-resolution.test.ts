import assert from 'node:assert'
import { describe, test } from 'node:test'
import {
  addCodeDependenciesToImportMap,
  addSpecifierToImportMap,
  createImportMap,
  getPackageBaseSpecifier,
  resolveImportMapSpecifier,
  resolveModuleUrl,
} from './module-resolution'

describe('module resolution manifest', () => {
  test('adds exact and prefix entries for root packages', () => {
    const imports: Record<string, string> = {}
    addSpecifierToImportMap(imports, 'lodash', '4.17.21')

    assert.deepStrictEqual(createImportMap(imports), {
      imports: {
        lodash: 'https://esm.sh/lodash@4.17.21',
        'lodash/': 'https://esm.sh/lodash@4.17.21/',
      },
    })
  })

  test('adds exact subpath entries while preserving the base package prefix', () => {
    const imports: Record<string, string> = {}
    addSpecifierToImportMap(imports, 'react-dom/client', '19.2.0')

    assert.deepStrictEqual(createImportMap(imports), {
      imports: {
        'react-dom': 'https://esm.sh/react-dom@19.2.0',
        'react-dom/': 'https://esm.sh/react-dom@19.2.0/',
        'react-dom/client': 'https://esm.sh/react-dom@19.2.0/client',
      },
    })
  })

  test('extracts shared dependencies from source code', () => {
    const imports: Record<string, string> = {}
    addCodeDependenciesToImportMap(
      imports,
      `
        import React from 'react'
        import { createRoot } from 'react-dom/client'
        const loadZod = () => import('zod')
        import './local-file'
      `
    )

    assert.deepStrictEqual(createImportMap(imports), {
      imports: {
        react: 'https://esm.sh/react',
        'react/': 'https://esm.sh/react/',
        'react-dom': 'https://esm.sh/react-dom',
        'react-dom/': 'https://esm.sh/react-dom/',
        'react-dom/client': 'https://esm.sh/react-dom/client',
        zod: 'https://esm.sh/zod',
        'zod/': 'https://esm.sh/zod/',
      },
    })
  })

  test('resolves import-map prefixes using the most specific match', () => {
    const imports: Record<string, string> = {}
    addSpecifierToImportMap(imports, 'react-dom/client', '19.2.0')

    assert.strictEqual(resolveImportMapSpecifier(imports, 'react-dom/client'), 'https://esm.sh/react-dom@19.2.0/client')
    assert.strictEqual(resolveImportMapSpecifier(imports, 'react-dom/server'), 'https://esm.sh/react-dom@19.2.0/server')
  })

  test('falls back to direct esm.sh URLs for unresolved specifiers', () => {
    const imports: Record<string, string> = {}
    addSpecifierToImportMap(imports, 'react', '19.2.0')

    assert.strictEqual(resolveModuleUrl(imports, 'react'), 'https://esm.sh/react@19.2.0')
    assert.strictEqual(resolveModuleUrl(imports, '/lodash/debounce'), 'https://esm.sh/lodash/debounce')
    assert.strictEqual(resolveModuleUrl(imports, 'https://cdn.example.com/mod.js'), 'https://cdn.example.com/mod.js')
  })

  test('computes base package specifiers for scoped and unscoped packages', () => {
    assert.strictEqual(getPackageBaseSpecifier('lodash/debounce'), 'lodash')
    assert.strictEqual(getPackageBaseSpecifier('@babel/core/parser'), '@babel/core')
  })
})
