import { parseModuleDeps } from './utils'

export const ESM_SH_ORIGIN = 'https://esm.sh'

export interface ImportMapDefinition {
  imports: Record<string, string>
}

const HTTP_URL_PATTERN = /^https?:\/\//i

const setImportMapEntry = (imports: Record<string, string>, specifier: string, target: string): boolean => {
  if (!specifier || imports[specifier] === target) {
    return false
  }

  imports[specifier] = target
  return true
}

export const isExternalModuleSpecifier = (specifier: string): boolean =>
  Boolean(specifier) &&
  !specifier.startsWith('./') &&
  !specifier.startsWith('../') &&
  !specifier.startsWith('/') &&
  !HTTP_URL_PATTERN.test(specifier)

export const getPackageBaseSpecifier = (specifier: string): string => {
  if (!specifier) {
    return specifier
  }

  const normalizedSpecifier = specifier.replace(/^\/+/, '')

  if (normalizedSpecifier.startsWith('@')) {
    const parts = normalizedSpecifier.split('/')
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : normalizedSpecifier
  }

  return normalizedSpecifier.split('/')[0]
}

const applyVersionToSpecifier = (specifier: string, version?: string): string => {
  if (!specifier || !version) {
    return specifier
  }

  const baseSpecifier = getPackageBaseSpecifier(specifier)
  const subpath = specifier.slice(baseSpecifier.length)
  return `${baseSpecifier}@${version}${subpath}`
}

export const toEsmShUrl = (specifier: string): string => {
  if (HTTP_URL_PATTERN.test(specifier)) {
    return specifier
  }

  if (!specifier) {
    return `${ESM_SH_ORIGIN}/`
  }

  const normalizedSpecifier = specifier.startsWith('/') ? specifier : `/${specifier}`
  return `${ESM_SH_ORIGIN}${normalizedSpecifier}`
}

export const addSpecifierToImportMap = (
  imports: Record<string, string>,
  specifier: string,
  version?: string
): boolean => {
  const normalizedSpecifier = specifier.replace(/^\/+/, '')
  if (!normalizedSpecifier || HTTP_URL_PATTERN.test(normalizedSpecifier)) {
    return false
  }

  const baseSpecifier = getPackageBaseSpecifier(normalizedSpecifier)
  const versionedBaseSpecifier = applyVersionToSpecifier(baseSpecifier, version)
  const versionedSpecifier = applyVersionToSpecifier(normalizedSpecifier, version)

  let changed = false
  changed = setImportMapEntry(imports, normalizedSpecifier, toEsmShUrl(versionedSpecifier)) || changed
  changed = setImportMapEntry(imports, baseSpecifier, toEsmShUrl(versionedBaseSpecifier)) || changed
  changed = setImportMapEntry(imports, `${baseSpecifier}/`, toEsmShUrl(`${versionedBaseSpecifier}/`)) || changed

  return changed
}

export const addCodeDependenciesToImportMap = (imports: Record<string, string>, code: string): boolean => {
  let changed = false

  for (const specifier of parseModuleDeps(code)) {
    if (!isExternalModuleSpecifier(specifier)) {
      continue
    }

    changed = addSpecifierToImportMap(imports, specifier) || changed
  }

  return changed
}

export const createImportMap = (imports: Record<string, string>): ImportMapDefinition => ({
  imports: Object.fromEntries(Object.entries(imports).sort(([left], [right]) => left.localeCompare(right))),
})

export const stringifyImportMap = (imports: Record<string, string>): string => JSON.stringify(createImportMap(imports), null, 2)

export const resolveImportMapSpecifier = (
  imports: Record<string, string>,
  specifier: string
): string | undefined => {
  if (imports[specifier]) {
    return imports[specifier]
  }

  const bestPrefixMatch = Object.keys(imports)
    .filter(key => key.endsWith('/') && specifier.startsWith(key))
    .sort((left, right) => right.length - left.length)[0]

  if (!bestPrefixMatch) {
    return undefined
  }

  return `${imports[bestPrefixMatch]}${specifier.slice(bestPrefixMatch.length)}`
}

export const resolveModuleUrl = (imports: Record<string, string>, specifier: string): string => {
  if (HTTP_URL_PATTERN.test(specifier)) {
    return specifier
  }

  const resolvedSpecifier = resolveImportMapSpecifier(imports, specifier)
  if (resolvedSpecifier) {
    return resolvedSpecifier
  }

  return toEsmShUrl(specifier)
}
