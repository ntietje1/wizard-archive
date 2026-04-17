import { createCanonicalSlugHelpers, slugify } from '../common/slug'
import { parseOrThrowClientValidation } from '../common/zod'
import type { BrandedString } from '../common/slug'
import { z } from 'zod'
import { USERNAME_MAX_LENGTH, USERNAME_MIN_LENGTH } from './constants'

export type Username = BrandedString<'Username'>

const usernameHelpers = createCanonicalSlugHelpers({
  brand: 'Username',
  label: 'Username',
  minLength: USERNAME_MIN_LENGTH,
  maxLength: USERNAME_MAX_LENGTH,
  fallbackMessage: 'Invalid username',
})

export const usernameValueSchema = usernameHelpers.valueSchema
export const usernameSchema = usernameHelpers.schema
export const usernameValidator = usernameHelpers.validator
export const validateUsername = usernameHelpers.validate
export const parseUsername = usernameHelpers.parse
export const assertUsername = usernameHelpers.assert

const emailSchema = z.email('Please enter a valid email address')

export function normalizeUsernameInput(input: string): string {
  return slugify(input)
}

export function validateEmail(email: string): string | null {
  const result = emailSchema.safeParse(email)
  return result.success
    ? null
    : (result.error.issues[0]?.message ?? 'Please enter a valid email address')
}

export function requireUsername(username: string): Username {
  return parseOrThrowClientValidation(usernameSchema, username, 'Invalid username')
}
