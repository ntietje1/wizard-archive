import { createSlugHelpers } from '../common/slug'
import type { BrandedString } from '../common/slug'
import { USERNAME_MAX_LENGTH } from './constants'
import type { SlugOptions } from '../../shared/slugs'

export type Username = BrandedString<'Username'>

export const USERNAME_SLUG_OPTIONS = {
  label: 'Username',
  minLength: 4,
  maxLength: USERNAME_MAX_LENGTH,
} satisfies SlugOptions

const usernameHelpers = createSlugHelpers<'Username'>({
  ...USERNAME_SLUG_OPTIONS,
})

const storedUsernameHelpers = createSlugHelpers<'Username'>({
  label: USERNAME_SLUG_OPTIONS.label,
  maxLength: USERNAME_SLUG_OPTIONS.maxLength,
})

export const usernameValidator = usernameHelpers.validator
export const validateUsername = usernameHelpers.validate
export const parseUsername = usernameHelpers.parse
export const assertUsername = usernameHelpers.assert
export const assertStoredUsername = storedUsernameHelpers.assert

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function normalizeUsernameInput(input: string): string {
  return input.trim().toLowerCase()
}

export function validateEmail(email: string): string | null {
  return EMAIL_REGEX.test(email) ? null : 'Please enter a valid email address'
}
