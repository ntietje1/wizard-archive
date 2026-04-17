import type { BrandedString } from '../common/slug'
import { parseOrThrowClientValidation } from '../common/zod'
import { z } from 'zod'
import { slugify } from '../common/slug'
import { parseSidebarItemSlug, validateSidebarItemSlug } from './slug'
import {
  SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS,
  SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS_DISPLAY,
  SIDEBAR_ITEM_NAME_MAX_LENGTH,
  hasSidebarItemControlChars,
} from './constants'
import type { Id } from '../_generated/dataModel'

export type ValidationResult = { valid: true } | { valid: false; error: string }

export type SidebarItemName = BrandedString<'SidebarItemName'>

export const sidebarItemNameValueSchema = z
  .string()
  .refine((value) => value.trim().length > 0, 'Name is required')
  .refine((value) => value === value.trim(), 'Name cannot start or end with whitespace')
  .max(
    SIDEBAR_ITEM_NAME_MAX_LENGTH,
    `Name must be ${SIDEBAR_ITEM_NAME_MAX_LENGTH} characters or fewer`,
  )
  .refine(
    (value) => !SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS.test(value),
    `Name cannot contain any of: ${SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS_DISPLAY}`,
  )
  .refine((value) => !hasSidebarItemControlChars(value), 'Name cannot contain control characters')
  .refine(
    (value) => !value.startsWith('.') && !value.endsWith('.'),
    'Name cannot start or end with a dot',
  )
  .refine(
    (value) => parseSidebarItemSlug(slugify(value)) !== null,
    'Name must contain at least one letter or number',
  )

export const sidebarItemNameSchema = sidebarItemNameValueSchema.transform(
  (value) => value as SidebarItemName,
)

function zodResultToValidationResult(result: z.ZodSafeParseResult<string>): ValidationResult {
  if (result.success) {
    return { valid: true }
  }

  return {
    valid: false,
    error: result.error.issues[0]?.message ?? 'Invalid value',
  }
}

export function validateItemName(name: string): ValidationResult {
  return zodResultToValidationResult(sidebarItemNameValueSchema.safeParse(name))
}

export function parseSidebarItemName(name: string): SidebarItemName | null {
  const result = sidebarItemNameSchema.safeParse(name)
  return result.success ? result.data : null
}

export function assertSidebarItemName(name: string): SidebarItemName {
  const parsed = parseSidebarItemName(name)
  if (!parsed) {
    const result = validateItemName(name)
    throw new Error(result.valid ? 'Invalid sidebar item name' : result.error)
  }
  return parsed
}

export function requireSidebarItemName(name: string): SidebarItemName {
  return parseOrThrowClientValidation(sidebarItemNameSchema, name, 'Invalid sidebar item name')
}

export function validateItemSlug(slug: string): ValidationResult {
  const error = validateSidebarItemSlug(slug)
  return error ? { valid: false, error } : { valid: true }
}

/**
 * Checks if a name conflicts with existing siblings (case-insensitive).
 * @param name - The name to check
 * @param siblings - All items under the same parent
 * @param excludeId - Optional ID to exclude from conflict check (for updates)
 */
export function checkNameConflict(
  name: string,
  siblings: Array<{ _id: Id<'sidebarItems'>; name: string }>,
  excludeId?: Id<'sidebarItems'>,
): ValidationResult {
  const normalizedName = name.trim().toLowerCase()
  const conflict = siblings.find(
    (item) => item.name.trim().toLowerCase() === normalizedName && item._id !== excludeId,
  )

  if (conflict) {
    return {
      valid: false,
      error: 'An item with this name already exists here',
    }
  }
  return { valid: true }
}

/**
 * Checks if setting a new parent would create a circular reference.
 * @param itemId - The item being moved
 * @param newParentId - The proposed new parent
 * @param getParent - Callback to look up a parent item by ID
 */
export function validateNoCircularParent(
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  getParent: (id: Id<'sidebarItems'>) => { parentId: Id<'sidebarItems'> | null } | undefined,
): ValidationResult {
  if (!newParentId) {
    return { valid: true }
  }

  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  const seen = new Set<Id<'sidebarItems'>>()
  let currentId: Id<'sidebarItems'> | null = newParentId

  while (currentId) {
    if (seen.has(currentId)) {
      break
    }
    seen.add(currentId)

    if (currentId === itemId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current = getParent(currentId)
    currentId = current?.parentId ?? null
  }

  return { valid: true }
}
