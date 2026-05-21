const DEFAULT_SLUG_LABEL = 'Slug'
const DEFAULT_SLUG_MAX_LENGTH = 255
const DEFAULT_SLUG_FALLBACK = 'slug'
const MAX_DEDUPLICATE_ATTEMPTS = 1_000

export type SlugOptions = {
  label?: string
  minLength?: number
  maxLength?: number
}

type SlugifyOptions = {
  fallback?: string
  maxLength?: number
}

type DeduplicateSlugOptions = SlugOptions & {
  fallback?: string
}

function getMaxLength(maxLength: number | undefined): number {
  return maxLength ?? DEFAULT_SLUG_MAX_LENGTH
}

function normalizeForSlug(input: string, maxLength: number): string {
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/[-_]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')

  return normalized.slice(0, maxLength).replace(/[-_]+$/g, '')
}

export function slugify(input: string, options: SlugifyOptions = {}): string {
  const maxLength = getMaxLength(options.maxLength)
  const slug = normalizeForSlug(input, maxLength)
  if (slug || options.fallback === undefined) {
    return slug
  }
  return normalizeForSlug(options.fallback, maxLength)
}

export function validateSlug(slug: string, options: SlugOptions = {}): string | null {
  const label = options.label ?? DEFAULT_SLUG_LABEL
  const maxLength = getMaxLength(options.maxLength)

  if (slug.trim().length === 0) {
    return `${label} is required`
  }
  if (slug !== slug.trim()) {
    return `${label} cannot start or end with whitespace`
  }
  if (options.minLength !== undefined && slug.length < options.minLength) {
    return `${label} must be at least ${options.minLength} characters`
  }
  if (/[A-Z]/.test(slug)) {
    return `${label} cannot contain uppercase letters`
  }
  if (/\s/.test(slug)) {
    return `${label} cannot contain spaces`
  }
  if (/[^a-z0-9_-]/.test(slug)) {
    return `${label} can only contain lowercase letters, numbers, hyphens, and underscores`
  }
  if (/^[-_]|[-_]$/.test(slug)) {
    return `${label} cannot start or end with a separator`
  }
  if (/[-_]{2,}/.test(slug)) {
    return `${label} cannot contain consecutive separators`
  }
  if (slug.length > maxLength) {
    return `${label} must be at most ${maxLength} characters`
  }
  return null
}

export function parseSlug(slug: string, options: SlugOptions = {}): string | null {
  return validateSlug(slug, options) === null ? slug : null
}

function assertSlug(slug: string, options: SlugOptions = {}): string {
  const error = validateSlug(slug, options)
  if (error) {
    throw new Error(error)
  }
  return slug
}

function appendSuffix(base: string, suffix: string, maxLength: number): string | null {
  if (suffix.length >= maxLength) {
    return null
  }
  const baseLimit = maxLength - suffix.length
  const truncatedBase = base.slice(0, Math.max(0, baseLimit)).replace(/[-_]+$/g, '')
  return truncatedBase ? `${truncatedBase}${suffix}` : null
}

function nextDedupeCandidate(base: string, offset: number, maxLength: number): string | null {
  const numericSuffix = /^(.*[-_])(\d+)$/.exec(base)
  if (!numericSuffix) return appendSuffix(base, `-${offset}`, maxLength)

  const [, rootWithSeparator, suffix] = numericSuffix
  const separator = rootWithSeparator[rootWithSeparator.length - 1]
  return appendSuffix(
    rootWithSeparator.slice(0, -1),
    `${separator}${Number(suffix) + offset}`,
    maxLength,
  )
}

export function deduplicateSlug(
  baseSlug: string,
  existingSlugs: Iterable<string>,
  options: DeduplicateSlugOptions = {},
): string {
  const maxLength = getMaxLength(options.maxLength)
  const fallback = options.fallback ?? DEFAULT_SLUG_FALLBACK
  const slug = parseSlug(baseSlug, options) ?? slugify(baseSlug, { fallback, maxLength })

  const validSlug = assertSlug(slug, options)
  const existing = new Set(existingSlugs)
  if (!existing.has(validSlug)) {
    return validSlug
  }

  for (let suffixNumber = 1; suffixNumber <= MAX_DEDUPLICATE_ATTEMPTS; suffixNumber += 1) {
    const candidate = nextDedupeCandidate(validSlug, suffixNumber, maxLength)
    if (!candidate) break
    if (validateSlug(candidate, options) === null && !existing.has(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `Unable to resolve a unique ${(options.label ?? DEFAULT_SLUG_LABEL).toLowerCase()}`,
  )
}
