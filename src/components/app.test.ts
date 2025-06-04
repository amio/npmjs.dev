import assert from 'node:assert'
import { test, describe } from 'node:test'
import { getPackageNameFromUrl, generateExampleCode } from './app'

describe('getPackageNameFromUrl', () => {
  test('should extract basic package name from URL', () => {
    const url = 'https://example.com/lodash'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'lodash')
  })

  test('should extract full scoped package name from URL', () => {
    const url = 'https://example.com/@babel/core'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, '@babel/core')
  })

  test('should extract package name with dashes and dots', () => {
    const url = 'https://example.com/react-dom'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'react-dom')
  })

  test('should extract package name ignoring query parameters', () => {
    const url = 'https://example.com/express?version=4.18.0'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'express')
  })

  test('should extract package name ignoring hash fragments', () => {
    const url = 'https://example.com/axios#readme'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'axios')
  })

  test('should extract package name ignoring both query and hash', () => {
    const url = 'https://example.com/moment?tab=readme#installation'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'moment')
  })

  test('should handle URLs with multiple path segments (takes package name only)', () => {
    const url = 'https://example.com/webpack/docs/configuration'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'webpack')
  })

  test('should handle scoped packages with additional path segments', () => {
    const url = 'https://example.com/@babel/core/docs/api'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, '@babel/core')
  })

  test('should return default when no package name in URL', () => {
    const url = 'https://example.com/'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'lodash')
  })

  test('should return default when URL has no path', () => {
    const url = 'https://example.com'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'lodash')
  })

  test('should handle relative URLs', () => {
    const url = '/typescript'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'typescript')
  })

  test('should handle relative URLs with scoped packages', () => {
    const url = '/@types/node'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, '@types/node')
  })

  test('should handle URLs with port numbers', () => {
    const url = 'http://localhost:3000/vite'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'vite')
  })

  test('should handle malformed URLs gracefully', () => {
    const url = 'not-a-valid-url'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'lodash')
  })

  test('should handle empty string gracefully', () => {
    const url = ''
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, 'lodash')
  })

  test('should handle scoped package with only scope (incomplete)', () => {
    const url = 'https://example.com/@babel'
    const result = getPackageNameFromUrl(url)
    assert.strictEqual(result, '@babel')
  })
})

describe('generateExampleCode', () => {
  test('should generate basic import statement', () => {
    const result = generateExampleCode('lodash')
    assert.strictEqual(result, "import lodash from 'lodash'")
  })

  test('should handle scoped packages', () => {
    const result = generateExampleCode('@babel/core')
    assert.strictEqual(result, "import _babel_core from '@babel/core'")
  })

  test('should handle packages with dashes', () => {
    const result = generateExampleCode('react-dom')
    assert.strictEqual(result, "import react_dom from 'react-dom'")
  })

  test('should handle packages with dots', () => {
    const result = generateExampleCode('lodash.debounce')
    assert.strictEqual(result, "import lodash_debounce from 'lodash.debounce'")
  })

  test('should handle package names starting with numbers', () => {
    const result = generateExampleCode('2-colors')
    assert.strictEqual(result, "import _2_colors from '2-colors'")
  })

  test('should handle complex package names', () => {
    const result = generateExampleCode('@types/node-fetch@2.6.2')
    assert.strictEqual(result, "import _types_node_fetch_2_6_2 from '@types/node-fetch@2.6.2'")
  })

  test('should remove invalid characters', () => {
    const result = generateExampleCode('package@#$%')
    assert.strictEqual(result, "import package from 'package@#$%'")
  })

  test('should handle empty package name', () => {
    const result = generateExampleCode('')
    assert.strictEqual(result, "import  from ''")
  })
})
