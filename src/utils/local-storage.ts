/**
 * LocalStorage utilities for managing saved code snippets per package.
 * Implements a 100-item limit with LRU (Least Recently Used) eviction.
 */

const STORAGE_PREFIX = 'npmjs-dev-code:'
const METADATA_KEY = 'npmjs-dev-metadata'
const MAX_ITEMS = 100

interface StorageMetadata {
  packages: string[]
  timestamps: Record<string, number>
}

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
  return { packages: [], timestamps: {} }
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

  if (metadata.packages.length >= MAX_ITEMS) {
    // Find the least recently used package
    let oldestPackage = metadata.packages[0]
    let oldestTimestamp = metadata.timestamps[oldestPackage] || 0

    for (const pkg of metadata.packages) {
      const timestamp = metadata.timestamps[pkg] || 0
      if (timestamp < oldestTimestamp) {
        oldestTimestamp = timestamp
        oldestPackage = pkg
      }
    }

    // Remove the oldest item
    try {
      localStorage.removeItem(getStorageKey(oldestPackage))
      metadata.packages = metadata.packages.filter(p => p !== oldestPackage)
      delete metadata.timestamps[oldestPackage]
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

    // Update metadata
    if (!metadata.packages.includes(packageName)) {
      metadata.packages.push(packageName)
    }
    metadata.timestamps[packageName] = Date.now()
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
      metadata.timestamps[packageName] = Date.now()
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

    for (const pkg of metadata.packages) {
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
    return metadata.packages.length
  } catch (error) {
    return 0
  }
}
