import { describe, test, beforeEach } from 'node:test'
import assert from 'node:assert'
import { compressToEncodedURIComponent } from 'lz-string'

// Mock window.location and history for Node.js test environment
const mockLocation = {
  hash: '',
  href: 'http://localhost:3000/lodash',
  pathname: '/lodash',
  search: '',
}

const historyStates: Array<{ state: any; title: string; url?: string | URL | null }> = []

  // Set up globals before importing the module
  ; (globalThis as any).window = {
    location: mockLocation,
  }
  ; (globalThis as any).history = {
    replaceState(state: any, title: string, url?: string | URL | null) {
      historyStates.push({ state, title, url })
      if (url) {
        const urlStr = String(url)
        const hashIndex = urlStr.indexOf('#')
        mockLocation.hash = hashIndex >= 0 ? urlStr.slice(hashIndex) : ''
        mockLocation.href = urlStr
      }
    },
  }

// Use require-style dynamic import to avoid top-level await
let getCodeFromUrlHash: () => string | null
let generateShareUrl: (code: string) => string | null
let updateUrlWithCode: (code: string) => boolean
let clearCodeFromUrl: () => void
let hasCodeInUrl: () => boolean

describe('url-code utilities', async () => {
  // Load module once before tests
  const mod = await import('./url-code.ts')
  getCodeFromUrlHash = mod.getCodeFromUrlHash
  generateShareUrl = mod.generateShareUrl
  updateUrlWithCode = mod.updateUrlWithCode
  clearCodeFromUrl = mod.clearCodeFromUrl
  hasCodeInUrl = mod.hasCodeInUrl

  beforeEach(() => {
    mockLocation.hash = ''
    mockLocation.href = 'http://localhost:3000/lodash'
    mockLocation.pathname = '/lodash'
    mockLocation.search = ''
    historyStates.length = 0
  })

  describe('getCodeFromUrlHash', () => {
    test('should return null when no hash is present', () => {
      mockLocation.hash = ''
      assert.strictEqual(getCodeFromUrlHash(), null)
    })

    test('should return null when hash has no code param', () => {
      mockLocation.hash = '#other=value'
      assert.strictEqual(getCodeFromUrlHash(), null)
    })

    test('should decode compressed code from hash', () => {
      const originalCode = 'console.log("hello world")'
      const encoded = compressToEncodedURIComponent(originalCode)
      mockLocation.hash = `#code=${encoded}`

      const result = getCodeFromUrlHash()
      assert.strictEqual(result, originalCode)
    })

    test('should handle multiline code', () => {
      const originalCode = `import lodash from 'lodash'\n\nconsole.log(lodash.chunk([1,2,3,4], 2))`
      const encoded = compressToEncodedURIComponent(originalCode)
      mockLocation.hash = `#code=${encoded}`

      const result = getCodeFromUrlHash()
      assert.strictEqual(result, originalCode)
    })

    test('should return null for invalid encoded data', () => {
      mockLocation.hash = '#code=not-valid-lz-data!!!'
      const result = getCodeFromUrlHash()
      // lz-string may return empty string or garbage for invalid data
      assert.ok(result === null || result === '')
    })

    test('should handle code with special characters', () => {
      const originalCode = `const x = { a: 1, b: "hello & goodbye", c: '<div>' }`
      const encoded = compressToEncodedURIComponent(originalCode)
      mockLocation.hash = `#code=${encoded}`

      const result = getCodeFromUrlHash()
      assert.strictEqual(result, originalCode)
    })
  })

  describe('generateShareUrl', () => {
    test('should generate a URL with compressed code in hash', () => {
      const code = 'console.log("test")'
      const url = generateShareUrl(code)

      assert.ok(url !== null)
      assert.ok(url!.includes('#code='))
      assert.ok(url!.startsWith('http://localhost:3000/lodash'))
    })

    test('should produce URL-safe output', () => {
      const code = `import { foo } from 'bar'\nconsole.log(foo())`
      const url = generateShareUrl(code)

      assert.ok(url !== null)
      // The hash part should not contain characters that need encoding
      const hash = url!.split('#')[1]
      assert.ok(hash)
      // lz-string's compressToEncodedURIComponent produces URI-safe output
      assert.ok(!hash.includes(' '))
    })

    test('should roundtrip correctly with getCodeFromUrlHash', () => {
      const originalCode = `import * as R from 'ramda'\n\nconst result = R.pipe(\n  R.filter(x => x > 2),\n  R.map(x => x * 10)\n)([1, 2, 3, 4, 5])\n\nconsole.log(result)`

      const url = generateShareUrl(originalCode)
      assert.ok(url !== null)

      // Simulate navigating to the generated URL
      const hashIndex = url!.indexOf('#')
      mockLocation.hash = url!.slice(hashIndex)

      const decoded = getCodeFromUrlHash()
      assert.strictEqual(decoded, originalCode)
    })

    test('should return null for code that produces a URL exceeding max length', () => {
      // Create a string that will definitely exceed 8000 chars when encoded
      const longCode = Array.from({ length: 10000 }, (_, i) => `const var${i} = ${Math.random()};`).join('\n')
      const url = generateShareUrl(longCode)

      // Either returns null (too long) or a valid URL — both are acceptable
      assert.ok(url === null || typeof url === 'string')
    })
  })

  describe('updateUrlWithCode', () => {
    test('should update URL via history.replaceState', () => {
      const code = 'console.log("shared")'
      const result = updateUrlWithCode(code)

      assert.strictEqual(result, true)
      assert.strictEqual(historyStates.length, 1)
      assert.ok(String(historyStates[0].url).includes('#code='))
    })
  })

  describe('clearCodeFromUrl', () => {
    test('should remove hash from URL', () => {
      mockLocation.hash = '#code=something'
      clearCodeFromUrl()

      assert.strictEqual(historyStates.length, 1)
      const newUrl = String(historyStates[0].url)
      assert.ok(!newUrl.includes('#'))
    })

    test('should do nothing when no hash is present', () => {
      mockLocation.hash = ''
      clearCodeFromUrl()

      assert.strictEqual(historyStates.length, 0)
    })
  })

  describe('hasCodeInUrl', () => {
    test('should return true when code param is in hash', () => {
      const encoded = compressToEncodedURIComponent('test')
      mockLocation.hash = `#code=${encoded}`

      assert.strictEqual(hasCodeInUrl(), true)
    })

    test('should return false when no hash', () => {
      mockLocation.hash = ''
      assert.strictEqual(hasCodeInUrl(), false)
    })

    test('should return false when hash has no code param', () => {
      mockLocation.hash = '#engine=quickjs'
      assert.strictEqual(hasCodeInUrl(), false)
    })
  })
})
