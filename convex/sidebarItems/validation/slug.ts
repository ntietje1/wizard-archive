import { createSlugHelpers } from '../../common/slug'
import type { BrandedString } from '../../common/slug'

export const SIDEBAR_ITEM_SLUG_MAX_LENGTH = 255

export type SidebarItemSlug = BrandedString<'SidebarItemSlug'>

const sidebarItemSlugHelpers = createSlugHelpers<'SidebarItemSlug'>({
  label: 'Slug',
  maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
})

export const sidebarItemSlugValidator = sidebarItemSlugHelpers.validator
export const validateSidebarItemSlug = sidebarItemSlugHelpers.validate
export const parseSidebarItemSlug = sidebarItemSlugHelpers.parse
export const assertSidebarItemSlug = sidebarItemSlugHelpers.assert
