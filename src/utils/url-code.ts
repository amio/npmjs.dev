import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string'

const CODE_PARAM = 'code'
const MAX_URL_LENGTH = 8000

/**
 * Extract code from URL hash if present.
 * Expected format: #code=<lz-compressed-string>
 */
export const getCodeFromUrlHash = (): string | null => {
  const hash = window.location.hash.slice(1) // remove leading #
  if (!hash) return null

  const params = new URLSearchParams(hash)
  const encoded = params.get(CODE_PARAM)
  if (!encoded) return null

  try {
    const decoded = decompressFromEncodedURIComponent(encoded)
    return decoded || null
  } catch {
    return null
  }
}

/**
 * Generate a shareable URL with code encoded in the hash.
 * Returns null if the resulting URL would be too long.
 */
export const generateShareUrl = (code: string): string | null => {
  const encoded = compressToEncodedURIComponent(code)
  const url = new URL(window.location.href)
  url.hash = `${CODE_PARAM}=${encoded}`

  const result = url.toString()
  if (result.length > MAX_URL_LENGTH) {
    return null
  }

  return result
}

/**
 * Update the current URL hash with compressed code.
 * Uses replaceState to avoid polluting browser history.
 * Returns false if the URL would be too long.
 */
export const updateUrlWithCode = (code: string): boolean => {
  const url = generateShareUrl(code)
  if (!url) return false

  history.replaceState(null, '', url)
  return true
}

/**
 * Remove the code hash from the current URL.
 * Uses replaceState to avoid polluting browser history.
 */
export const clearCodeFromUrl = (): void => {
  if (!window.location.hash) return
  history.replaceState(null, '', window.location.pathname + window.location.search)
}

/**
 * Check whether the current URL contains shared code in the hash.
 */
export const hasCodeInUrl = (): boolean => {
  const hash = window.location.hash.slice(1)
  if (!hash) return false
  const params = new URLSearchParams(hash)
  return params.has(CODE_PARAM)
}
