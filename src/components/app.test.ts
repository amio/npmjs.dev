import assert from 'node:assert'
import { describe, test } from 'node:test'
import { generateExampleCode, getPackageNameFromUrl } from './app'

describe('app helpers', () => {
  test('parses regular and scoped package names from the URL', () => {
    assert.strictEqual(getPackageNameFromUrl('https://npmjs.dev/lodash'), 'lodash')
    assert.strictEqual(getPackageNameFromUrl('https://npmjs.dev/@babel/core'), '@babel/core')
  })

  test('generates namespace import example code for broad package compatibility', () => {
    const exampleCode = generateExampleCode('silabajs')

    assert.match(exampleCode, /import \* as silabajs from 'silabajs'/)
    assert.match(exampleCode, /Object\.keys\(silabajs\)/)
  })

  test('sanitizes invalid characters before generating example code', () => {
    const exampleCode = generateExampleCode('lodash<script>')

    assert.match(exampleCode, /from 'lodashscript'/)
    assert.match(exampleCode, /import \* as lodashscript from/)
  })
})
