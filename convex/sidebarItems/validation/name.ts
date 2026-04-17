import type { BrandedString } from '../../common/slug'
import { parseOrThrowClientValidation } from '../../common/zod'
import { z } from 'zod'
import { slugify } from '../../common/slug'
import { parseSidebarItemSlug } from './slug'
import type { Id } from '../../_generated/dataModel'

export const SIDEBAR_ITEM_NAME_MAX_LENGTH = 255

export const SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS = /[/\\:*?"<>[\]#|]/
export const SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS_DISPLAY = '/ \\ : * ? " < > [ ] # |'

export function hasSidebarItemControlChars(value: string): boolean {
  for (const char of value) {
    const codePoint = char.codePointAt(0)
    if (
      codePoint !== undefined &&
      (codePoint <= 0x1f || (codePoint >= 0x7f && codePoint <= 0x9f))
    ) {
      return true
    }
  }

  return false
}

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

export function validateSidebarItemNameWithSiblings(
  name: string,
  siblings?: Array<{ _id: Id<'sidebarItems'>; name: string }>,
  excludeId?: Id<'sidebarItems'>,
): ValidationResult {
  const trimmedName = name.trim()
  const nameResult = validateItemName(trimmedName)
  if (!nameResult.valid) {
    return nameResult
  }

  if (!siblings) {
    return { valid: true }
  }

  return checkNameConflict(trimmedName, siblings, excludeId)
}
