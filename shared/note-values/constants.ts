import { deduplicateNumericSuffix } from '../deduplicateNumericSuffix'

interface NoteValueFunctionMetadata {
  name: string
  signature: string
  snippet: string
  description: string
  minArgs: number
  maxArgs?: number
}

export const NOTE_VALUE_FUNCTIONS = [
  {
    name: 'min',
    signature: 'min(value, ...values)',
    snippet: 'min()',
    description: 'Returns the smallest value.',
    minArgs: 1,
  },
  {
    name: 'max',
    signature: 'max(value, ...values)',
    snippet: 'max()',
    description: 'Returns the largest value.',
    minArgs: 1,
  },
  {
    name: 'round',
    signature: 'round(value)',
    snippet: 'round()',
    description: 'Rounds to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'floor',
    signature: 'floor(value)',
    snippet: 'floor()',
    description: 'Rounds down to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'ceil',
    signature: 'ceil(value)',
    snippet: 'ceil()',
    description: 'Rounds up to the nearest integer.',
    minArgs: 1,
    maxArgs: 1,
  },
  {
    name: 'abs',
    signature: 'abs(value)',
    snippet: 'abs()',
    description: 'Returns the absolute value.',
    minArgs: 1,
    maxArgs: 1,
  },
] as const satisfies ReadonlyArray<NoteValueFunctionMetadata>

export const NOTE_VALUE_FUNCTION_BY_NAME: ReadonlyMap<string, NoteValueFunctionMetadata> = new Map(
  NOTE_VALUE_FUNCTIONS.map((fn) => [fn.name, fn]),
)

const NOTE_VALUE_RESERVED_IDENTIFIERS = [
  'self',
  ...NOTE_VALUE_FUNCTIONS.map((fn) => fn.name),
] as const

const NOTE_VALUE_RESERVED_IDENTIFIER_SET = new Set<string>(NOTE_VALUE_RESERVED_IDENTIFIERS)

const NOTE_VALUE_SLUG_REGEX = /^[a-z][a-z0-9_-]*$/

export const NOTE_VALUE_DEFAULT_SLUG = 'value'

export function validateValueSlug(slug: string): string | null {
  if (slug.trim().length === 0) {
    return 'Value slug is required'
  }
  if (slug !== slug.trim()) {
    return 'Value slug cannot start or end with whitespace'
  }
  if (/[A-Z]/.test(slug)) {
    return 'Value slug cannot contain uppercase letters'
  }
  if (/\s/.test(slug)) {
    return 'Value slug cannot contain spaces'
  }
  if (/[^a-z0-9_-]/.test(slug)) {
    return 'Value slug can only contain lowercase letters, numbers, hyphens, and underscores'
  }
  if (!/^[a-z]/.test(slug)) {
    return 'Value slug must start with a lowercase letter'
  }
  if (NOTE_VALUE_RESERVED_IDENTIFIER_SET.has(slug)) {
    return `Value slug "${slug}" is reserved`
  }
  return null
}

export function isValidValueSlug(slug: string): boolean {
  return NOTE_VALUE_SLUG_REGEX.test(slug) && validateValueSlug(slug) === null
}

export function sanitizeValueSlug(input: string, fallback = NOTE_VALUE_DEFAULT_SLUG): string {
  const normalizedFallback = fallback
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

  const validFallback =
    NOTE_VALUE_SLUG_REGEX.test(normalizedFallback) &&
    !NOTE_VALUE_RESERVED_IDENTIFIER_SET.has(normalizedFallback)
      ? normalizedFallback
      : NOTE_VALUE_DEFAULT_SLUG

  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')

  let slug = normalized || validFallback
  if (!/^[a-z]/.test(slug)) {
    slug = `${validFallback}_${slug}`.replace(/_+/g, '_')
  }
  if (NOTE_VALUE_RESERVED_IDENTIFIER_SET.has(slug)) {
    slug = `${slug}_value`
  }
  if (!NOTE_VALUE_SLUG_REGEX.test(slug)) {
    slug = validFallback
  }
  if (NOTE_VALUE_RESERVED_IDENTIFIER_SET.has(slug)) {
    slug = `${validFallback}_value`
  }
  return slug
}

export function getUniqueValueSlug(baseSlug: string, existingSlugs: Iterable<string>): string {
  return deduplicateNumericSuffix(baseSlug, existingSlugs, {
    separator: '_',
    errorLabel: 'value slug',
  })
}

export function formatNoteValue(value: number): string {
  const rounded = Math.round(value * 100) / 100
  if (Object.is(rounded, -0)) {
    return '0'
  }
  return Number.isInteger(rounded) ? `${rounded}` : rounded.toFixed(2)
}
