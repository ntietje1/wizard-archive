import { brandString } from '../branded'
import { USERNAME_MAX_LENGTH } from './constants'
import type { BrandedString } from '../branded'

export type Username = BrandedString<'Username'>

const USERNAME_MIN_LENGTH = 4
const MAX_DEDUPLICATION_ATTEMPTS = 1_000

export function validateUsername(value: string): string | null {
  return validateUsernameSyntax(value, USERNAME_MIN_LENGTH)
}

export function parseUsername(value: string): Username | null {
  return validateUsername(value) === null ? brandString<'Username'>(value) : null
}

export function assertUsername(value: string): Username {
  const parsed = parseUsername(value)
  if (!parsed) {
    throw new Error(validateUsername(value) ?? 'Invalid username')
  }
  return parsed
}

export function assertStoredUsername(value: string): Username {
  const error = validateUsernameSyntax(value)
  if (error) throw new Error(error)
  return brandString<'Username'>(value)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeUsernameInput(input: string): string {
  return input.trim().toLowerCase()
}

export function normalizeUsernameCandidate(input: string, fallback: string): string {
  const normalized = normalizeUsernameSyntax(input)
  if (normalized) return normalized
  return normalizeUsernameSyntax(fallback) || 'user'
}

export function deduplicateUsername(base: string, existing: Iterable<string>): string {
  const username = assertStoredUsername(base)
  const reserved = new Set(existing)
  if (!reserved.has(username)) return username

  for (let offset = 1; offset <= MAX_DEDUPLICATION_ATTEMPTS; offset += 1) {
    const candidate = appendUsernameSuffix(username, offset)
    if (candidate && validateUsernameSyntax(candidate) === null && !reserved.has(candidate)) {
      return candidate
    }
  }
  throw new Error('Unable to resolve a unique username')
}

function validateUsernameSyntax(value: string, minLength?: number): string | null {
  if (value.trim().length === 0) return 'Username is required'
  if (value !== value.trim()) return 'Username cannot start or end with whitespace'
  if (minLength !== undefined && value.length < minLength) {
    return `Username must be at least ${minLength} characters`
  }
  if (/[A-Z]/.test(value)) return 'Username cannot contain uppercase letters'
  if (/\s/.test(value)) return 'Username cannot contain spaces'
  if (/[^a-z0-9_-]/.test(value)) {
    return 'Username can only contain lowercase letters, numbers, hyphens, and underscores'
  }
  if (/^[-_]|[-_]$/.test(value)) return 'Username cannot start or end with a separator'
  if (/[-_]{2,}/.test(value)) return 'Username cannot contain consecutive separators'
  if (value.length > USERNAME_MAX_LENGTH) {
    return `Username must be at most ${USERNAME_MAX_LENGTH} characters`
  }
  return null
}

function normalizeUsernameSyntax(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]+/g, '')
    .replace(/[-_]+/g, '-')
    .replace(/^[-_]+|[-_]+$/g, '')
    .slice(0, USERNAME_MAX_LENGTH)
    .replace(/[-_]+$/g, '')
}

function appendUsernameSuffix(base: string, offset: number): string | null {
  const numericSuffix = /^(.*[-_])(\d+)$/.exec(base)
  const suffix = numericSuffix
    ? `${numericSuffix[1]![numericSuffix[1]!.length - 1]!}${Number(numericSuffix[2]) + offset}`
    : `-${offset}`
  const root = numericSuffix ? numericSuffix[1]!.slice(0, -1) : base
  const truncated = root.slice(0, USERNAME_MAX_LENGTH - suffix.length).replace(/[-_]+$/g, '')
  return truncated ? `${truncated}${suffix}` : null
}

export function validateEmail(email: string): string | null {
  return EMAIL_REGEX.test(email) ? null : 'Please enter a valid email address'
}
