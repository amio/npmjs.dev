import { test, describe, beforeEach } from 'node:test'
import assert from 'node:assert'
import { saveCodeToStorage, loadCodeFromStorage, clearAllStorage, getStorageCount } from './local-storage'

// Mock localStorage for Node.js environment
class LocalStorageMock {
  private store: Record<string, string> = {}

  getItem(key: string): string | null {
    return this.store[key] || null
  }

  setItem(key: string, value: string): void {
    this.store[key] = value
  }

  removeItem(key: string): void {
    delete this.store[key]
  }

  clear(): void {
    this.store = {}
  }

  get length(): number {
    return Object.keys(this.store).length
  }
}

// Setup global localStorage mock
const localStorageMock = new LocalStorageMock()
;(global as any).localStorage = localStorageMock

describe('Local Storage Utilities', () => {
  beforeEach(() => {
    localStorageMock.clear()
  })

  test('should save and load code for a package', () => {
    const packageName = 'lodash'
    const code = 'import _ from "lodash"\nconsole.log(_)'

    saveCodeToStorage(packageName, code)
    const loaded = loadCodeFromStorage(packageName)

    assert.strictEqual(loaded, code)
  })

  test('should return null for non-existent package', () => {
    const loaded = loadCodeFromStorage('non-existent-package')
    assert.strictEqual(loaded, null)
  })

  test('should handle scoped packages', () => {
    const packageName = '@babel/core'
    const code = 'import babel from "@babel/core"'

    saveCodeToStorage(packageName, code)
    const loaded = loadCodeFromStorage(packageName)

    assert.strictEqual(loaded, code)
  })

  test('should update timestamp when code is accessed', () => {
    const packageName = 'react'
    const code = 'import React from "react"'

    saveCodeToStorage(packageName, code)

    // Wait a bit to ensure timestamp difference
    const before = Date.now()

    // Access the code
    loadCodeFromStorage(packageName)

    // Check that metadata was updated (timestamp should be >= before)
    const metadata = JSON.parse(localStorageMock.getItem('npmjs-dev-metadata') || '{}')
    assert.ok(metadata[packageName] >= before)
  })

  test('should handle storage limit of 100 items', () => {
    // Add 101 items
    for (let i = 0; i < 101; i++) {
      saveCodeToStorage(`package-${i}`, `code for package ${i}`)
    }

    // Should only have 100 items
    const count = getStorageCount()
    assert.strictEqual(count, 100)

    // The oldest item (package-0) should have been removed
    const oldest = loadCodeFromStorage('package-0')
    assert.strictEqual(oldest, null)

    // The newest item (package-100) should exist
    const newest = loadCodeFromStorage('package-100')
    assert.strictEqual(newest, 'code for package 100')
  })

  test('should evict least recently used item when limit is reached', () => {
    // Add 100 items
    for (let i = 0; i < 100; i++) {
      saveCodeToStorage(`package-${i}`, `code ${i}`)
    }

    // Access package-0 to update its timestamp
    loadCodeFromStorage('package-0')

    // Add one more item
    saveCodeToStorage('package-new', 'new code')

    // package-0 should still exist (it was recently accessed)
    const pkg0 = loadCodeFromStorage('package-0')
    assert.ok(pkg0 !== null)

    // package-1 should have been removed (oldest non-accessed)
    const pkg1 = loadCodeFromStorage('package-1')
    assert.strictEqual(pkg1, null)
  })

  test('should clear all storage', () => {
    saveCodeToStorage('lodash', 'import _ from "lodash"')
    saveCodeToStorage('react', 'import React from "react"')

    clearAllStorage()

    assert.strictEqual(loadCodeFromStorage('lodash'), null)
    assert.strictEqual(loadCodeFromStorage('react'), null)
    assert.strictEqual(getStorageCount(), 0)
  })

  test('should handle empty package name gracefully', () => {
    saveCodeToStorage('', 'some code')
    const loaded = loadCodeFromStorage('')
    assert.strictEqual(loaded, null)
  })

  test('should handle empty code gracefully', () => {
    saveCodeToStorage('test-package', '')
    const loaded = loadCodeFromStorage('test-package')
    assert.strictEqual(loaded, null)
  })

  test('should maintain metadata consistency', () => {
    const packages = ['pkg1', 'pkg2', 'pkg3']

    for (const pkg of packages) {
      saveCodeToStorage(pkg, `code for ${pkg}`)
    }

    const metadata = JSON.parse(localStorageMock.getItem('npmjs-dev-metadata') || '{}')
    const metadataKeys = Object.keys(metadata)

    assert.strictEqual(metadataKeys.length, 3)
    assert.ok(metadataKeys.includes('pkg1'))
    assert.ok(metadataKeys.includes('pkg2'))
    assert.ok(metadataKeys.includes('pkg3'))
    assert.ok(metadata['pkg1'])
    assert.ok(metadata['pkg2'])
    assert.ok(metadata['pkg3'])
  })

  test('should not add duplicate packages to metadata', () => {
    saveCodeToStorage('lodash', 'code 1')
    saveCodeToStorage('lodash', 'code 2')
    saveCodeToStorage('lodash', 'code 3')

    const count = getStorageCount()
    assert.strictEqual(count, 1)

    const metadata = JSON.parse(localStorageMock.getItem('npmjs-dev-metadata') || '{}')
    const lodashCount = Object.keys(metadata).filter((p: string) => p === 'lodash').length
    assert.strictEqual(lodashCount, 1)
  })
})
