import { createCanonicalSlugHelpers } from '../../common/slug'
import { parseOrThrowClientValidation } from '../../common/zod'
import type { BrandedString } from '../../common/slug'
import type { ValidationResult } from './name'

export const SIDEBAR_ITEM_SLUG_MAX_LENGTH = 255

export type SidebarItemSlug = BrandedString<'SidebarItemSlug'>

const INVALID_SLUG_MESSAGE = 'Invalid slug'

const sidebarItemSlugHelpers = createCanonicalSlugHelpers({
  brand: 'SidebarItemSlug',
  label: 'Slug',
  maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
  fallbackMessage: INVALID_SLUG_MESSAGE,
})

export const sidebarItemSlugValueSchema = sidebarItemSlugHelpers.valueSchema
export const sidebarItemSlugSchema = sidebarItemSlugHelpers.schema
export const sidebarItemSlugValidator = sidebarItemSlugHelpers.validator
export const validateSidebarItemSlug = sidebarItemSlugHelpers.validate
export const parseSidebarItemSlug = sidebarItemSlugHelpers.parse
export const assertSidebarItemSlug = sidebarItemSlugHelpers.assert

export function validateItemSlug(slug: string): ValidationResult {
  const error = validateSidebarItemSlug(slug)
  return error ? { valid: false, error } : { valid: true }
}

export function requireSidebarItemSlug(slug: string): SidebarItemSlug {
  return parseOrThrowClientValidation(sidebarItemSlugSchema, slug, INVALID_SLUG_MESSAGE)
}
