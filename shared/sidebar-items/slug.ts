import { brandString } from '../branded'
import { parseSlug, validateSlug } from '../slugs'
import type { BrandedString } from '../branded'

export const SIDEBAR_ITEM_SLUG_MAX_LENGTH = 255

export type SidebarItemSlug = BrandedString<'SidebarItemSlug'>

const SIDEBAR_ITEM_SLUG_OPTIONS = {
  label: 'Slug',
  maxLength: SIDEBAR_ITEM_SLUG_MAX_LENGTH,
} as const

function validateSidebarItemSlug(value: string): string | null {
  return validateSlug(value, SIDEBAR_ITEM_SLUG_OPTIONS)
}

export function parseSidebarItemSlug(value: string): SidebarItemSlug | null {
  const parsed = parseSlug(value, SIDEBAR_ITEM_SLUG_OPTIONS)
  return parsed ? brandString<'SidebarItemSlug'>(parsed) : null
}

export function assertSidebarItemSlug(value: string): SidebarItemSlug {
  const parsed = parseSidebarItemSlug(value)
  if (!parsed) {
    throw new Error(validateSidebarItemSlug(value) ?? 'Invalid slug')
  }
  return parsed
}
