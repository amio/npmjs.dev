/**
 * LocalStorage utilities for managing saved code snippets per package.
 * Implements a 100-item limit with LRU (Least Recently Used) eviction.
 */

const STORAGE_PREFIX = 'npmjs-dev-code:'
const METADATA_KEY = 'npmjs-dev-metadata'
const MAX_ITEMS = 100

type StorageMetadata = Record<string, number>

/**
 * Get the storage key for a package
 */
const getStorageKey = (packageName: string): string => {
  return `${STORAGE_PREFIX}${packageName}`
}

/**
 * Get or initialize metadata
 */
const getMetadata = (): StorageMetadata => {
  try {
    const data = localStorage.getItem(METADATA_KEY)
    if (data) {
      return JSON.parse(data)
    }
  } catch (error) {
    console.warn('Failed to read storage metadata:', error)
  }
  return {}
}

/**
 * Save metadata
 */
const saveMetadata = (metadata: StorageMetadata): void => {
  try {
    localStorage.setItem(METADATA_KEY, JSON.stringify(metadata))
  } catch (error) {
    console.warn('Failed to save storage metadata:', error)
  }
}

/**
 * Remove the oldest item if storage limit is reached
 */
const enforceStorageLimit = (): void => {
  const metadata = getMetadata()
  const packages = Object.keys(metadata)

  if (packages.length >= MAX_ITEMS) {
    // Find the least recently used package
    let oldestPackage = packages[0]
    let oldestTimestamp = metadata[oldestPackage] || 0

    for (const pkg of packages) {
      const timestamp = metadata[pkg] || 0
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp
        oldestPackage = pkg
      }
    }

    // Remove the oldest item
    try {
      localStorage.removeItem(getStorageKey(oldestPackage))
      delete metadata[oldestPackage]
      saveMetadata(metadata)
    } catch (error) {
      console.warn('Failed to remove oldest item:', error)
    }
  }
}

/**
 * Save code for a package to localStorage
 */
export const saveCodeToStorage = (packageName: string, code: string): void => {
  if (!packageName || !code) return

  try {
    enforceStorageLimit()

    const metadata = getMetadata()
    const key = getStorageKey(packageName)

    localStorage.setItem(key, code)

    // Update metadata with timestamp
    metadata[packageName] = Date.now()
    saveMetadata(metadata)
  } catch (error) {
    console.warn('Failed to save code to storage:', error)
  }
}

/**
 * Load code for a package from localStorage
 */
export const loadCodeFromStorage = (packageName: string): string | null => {
  if (!packageName) return null

  try {
    const key = getStorageKey(packageName)
    const code = localStorage.getItem(key)

    if (code) {
      // Update timestamp when accessed
      const metadata = getMetadata()
      metadata[packageName] = Date.now()
      saveMetadata(metadata)
    }

    return code
  } catch (error) {
    console.warn('Failed to load code from storage:', error)
    return null
  }
}

/**
 * Clear all stored code
 */
export const clearAllStorage = (): void => {
  try {
    const metadata = getMetadata()

    for (const pkg of Object.keys(metadata)) {
      localStorage.removeItem(getStorageKey(pkg))
    }

    localStorage.removeItem(METADATA_KEY)
  } catch (error) {
    console.warn('Failed to clear storage:', error)
  }
}

/**
 * Get the number of stored items
 */
export const getStorageCount = (): number => {
  try {
    const metadata = getMetadata()
    return Object.keys(metadata).length
  } catch (error) {
    return 0
  }
}
