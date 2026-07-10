type DeduplicateNumericSuffixOptions = {
  separator: string
  normalize?: (value: string) => string
  maxLength?: number
  errorLabel: string
}

const MAX_DEDUPE_BASE_STRIP_ITERATIONS = 1_000

function stripNumericSuffix(value: string, separator: string): string | null {
  const separatorIndex = value.lastIndexOf(separator)
  if (separatorIndex <= 0) {
    return null
  }

  const suffix = value.slice(separatorIndex + separator.length)
  return /^\d+$/.test(suffix) ? value.slice(0, separatorIndex) : null
}

function hasDedupeSequenceEvidence(
  root: string,
  existingValues: ReadonlySet<string>,
  ignoredValue: string,
  separator: string,
  normalize: (value: string) => string,
): boolean {
  const normalizedRoot = normalize(root)
  if (normalizedRoot !== ignoredValue && existingValues.has(normalizedRoot)) {
    return true
  }

  const prefix = `${normalizedRoot}${separator}`
  for (const value of existingValues) {
    if (value === ignoredValue) continue
    if (value.startsWith(prefix) && /^\d+$/.test(value.slice(prefix.length))) {
      return true
    }
  }
  return false
}

function getDedupeBase(
  base: string,
  existingValues: ReadonlySet<string>,
  ignoredValue: string,
  separator: string,
  normalize: (value: string) => string,
  errorLabel: string,
): string {
  let result = base
  let candidate = result
  let suffixCount = 0
  while (true) {
    if (suffixCount >= MAX_DEDUPE_BASE_STRIP_ITERATIONS) {
      throw new Error(`Unable to resolve a stable ${errorLabel} base`)
    }

    const nextCandidate = stripNumericSuffix(candidate, separator)
    if (!nextCandidate) {
      return result
    }

    candidate = nextCandidate
    suffixCount += 1
    if (hasDedupeSequenceEvidence(candidate, existingValues, ignoredValue, separator, normalize)) {
      result = candidate
    }
  }
}

export function deduplicateNumericSuffix(
  base: string,
  existingValues: Iterable<string>,
  {
    separator,
    normalize = (value) => value,
    maxLength,
    errorLabel,
  }: DeduplicateNumericSuffixOptions,
): string {
  const existing = new Set(Array.from(existingValues, normalize))
  const normalizedBase = normalize(base)
  if (!existing.has(normalizedBase)) {
    return base
  }

  const dedupeBase = getDedupeBase(base, existing, normalizedBase, separator, normalize, errorLabel)
  const normalizedDedupeBase = normalize(dedupeBase)
  if (normalizedDedupeBase !== normalizedBase && !existing.has(normalizedDedupeBase)) {
    return dedupeBase
  }

  for (let suffixNumber = 1; suffixNumber <= existing.size + 1; suffixNumber += 1) {
    const suffix = `${separator}${suffixNumber}`
    if (maxLength !== undefined && suffix.length > maxLength) {
      throw new Error(`Unable to resolve a unique ${errorLabel}`)
    }
    const baseLimit = maxLength === undefined ? undefined : maxLength - suffix.length
    const candidateBase =
      baseLimit === undefined ? dedupeBase : dedupeBase.slice(0, Math.max(0, baseLimit))
    const candidate = `${candidateBase}${suffix}`
    if (!existing.has(normalize(candidate))) {
      return candidate
    }
  }

  throw new Error(`Unable to resolve a unique ${errorLabel}`)
}
