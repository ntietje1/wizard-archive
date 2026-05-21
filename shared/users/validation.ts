import { brandString } from '../branded'
import { USERNAME_MAX_LENGTH } from './constants'
import { parseSlug, validateSlug } from '../slugs'
import type { BrandedString } from '../branded'
import type { SlugOptions } from '../slugs'

export type Username = BrandedString<'Username'>

export const USERNAME_SLUG_OPTIONS = {
  label: 'Username',
  minLength: 4,
  maxLength: USERNAME_MAX_LENGTH,
} satisfies SlugOptions

const STORED_USERNAME_SLUG_OPTIONS = {
  label: USERNAME_SLUG_OPTIONS.label,
  maxLength: USERNAME_SLUG_OPTIONS.maxLength,
} satisfies SlugOptions

export function validateUsername(value: string): string | null {
  return validateSlug(value, USERNAME_SLUG_OPTIONS)
}

export function parseUsername(value: string): Username | null {
  const parsed = parseSlug(value, USERNAME_SLUG_OPTIONS)
  return parsed ? brandString<'Username'>(parsed) : null
}

export function assertUsername(value: string): Username {
  const parsed = parseUsername(value)
  if (!parsed) {
    throw new Error(validateUsername(value) ?? 'Invalid username')
  }
  return parsed
}

export function assertStoredUsername(value: string): Username {
  const parsed = parseSlug(value, STORED_USERNAME_SLUG_OPTIONS)
  if (!parsed) {
    throw new Error(validateSlug(value, STORED_USERNAME_SLUG_OPTIONS) ?? 'Invalid username')
  }
  return brandString<'Username'>(parsed)
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeUsernameInput(input: string): string {
  return input.trim().toLowerCase()
}

export function validateEmail(email: string): string | null {
  return EMAIL_REGEX.test(email) ? null : 'Please enter a valid email address'
}
