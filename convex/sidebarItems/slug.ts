import { createCanonicalSlugHelpers } from '../common/slug'
import { parseOrThrowClientValidation } from '../common/zod'
import type { BrandedString } from '../common/slug'
import { SIDEBAR_ITEM_SLUG_MAX_LENGTH } from './constants'

export type SidebarItemSlug = BrandedString<'SidebarItemSlug'>

const sidebarItemSlugHelpers = createCanonicalSlugHelpers({
  brand: 'SidebarItemSlug',
  label: 'Slug',
  maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
  fallbackMessage: 'Invalid slug',
})

export const sidebarItemSlugValueSchema = sidebarItemSlugHelpers.valueSchema
export const sidebarItemSlugSchema = sidebarItemSlugHelpers.schema
export const sidebarItemSlugValidator = sidebarItemSlugHelpers.validator
export const validateSidebarItemSlug = sidebarItemSlugHelpers.validate
export const parseSidebarItemSlug = sidebarItemSlugHelpers.parse
export const assertSidebarItemSlug = sidebarItemSlugHelpers.assert

export function requireSidebarItemSlug(slug: string): SidebarItemSlug {
  return parseOrThrowClientValidation(sidebarItemSlugSchema, slug, 'Invalid slug')
}
