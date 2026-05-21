import type { BrandedString } from '../../common/slug'
import { slugify } from '../../common/slug'
import { ERROR_CODE, throwClientError } from '../../errors'
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

export function validateItemName(name: string): ValidationResult {
  if (name.trim().length === 0) {
    return { valid: false, error: 'Name is required' }
  }
  if (name !== name.trim()) {
    return { valid: false, error: 'Name cannot start or end with whitespace' }
  }
  if (name.length > SIDEBAR_ITEM_NAME_MAX_LENGTH) {
    return {
      valid: false,
      error: `Name must be ${SIDEBAR_ITEM_NAME_MAX_LENGTH} characters or fewer`,
    }
  }
  if (SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS.test(name)) {
    return {
      valid: false,
      error: `Name cannot contain any of: ${SIDEBAR_ITEM_FORBIDDEN_NAME_CHARS_DISPLAY}`,
    }
  }
  if (hasSidebarItemControlChars(name)) {
    return { valid: false, error: 'Name cannot contain control characters' }
  }
  if (name.startsWith('.') || name.endsWith('.')) {
    return { valid: false, error: 'Name cannot start or end with a dot' }
  }
  if (slugify(name).length === 0) {
    return { valid: false, error: 'Name must contain at least one letter or number' }
  }
  return { valid: true }
}

export function parseSidebarItemName(name: string): SidebarItemName | null {
  return validateItemName(name).valid ? (name as SidebarItemName) : null
}

export function assertSidebarItemName(name: string): SidebarItemName {
  const result = validateItemName(name)
  if (!result.valid) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, result.error)
  }

  const parsed = parseSidebarItemName(name)
  if (!parsed) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      'Validated sidebar item name could not be parsed',
    )
  }

  return parsed
}

export function requireSidebarItemName(name: string): SidebarItemName {
  return assertSidebarItemName(name)
}

export function requireOptionalSidebarItemName(
  name: string | undefined,
): SidebarItemName | undefined {
  if (name === undefined) {
    return undefined
  }

  return requireSidebarItemName(name)
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
  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    return nameResult
  }

  if (!siblings) {
    return { valid: true }
  }

  return checkNameConflict(name, siblings, excludeId)
}
