import type { Id } from '../_generated/dataModel'
import type { SidebarItemId } from './types/baseTypes'

export type ValidationResult = { valid: true } | { valid: false; error: string }

const FORBIDDEN_CHARS = /[/\\:*?"<>[\]#|]/
const FORBIDDEN_CHARS_DISPLAY = '/ \\ : * ? " < > [ ] # |'

/**
 * Validates that a name is a valid filesystem-safe item name.
 * Rules:
 * 1. Required & non-empty (after trim)
 * 2. Max 255 characters (after trim)
 * 3. No forbidden characters: / \ : * ? " < > [ ] # |
 * 4. No leading/trailing dots
 */
export function validateItemName(name: string): ValidationResult {
  const trimmed = name.trim()

  if (!trimmed) {
    return { valid: false, error: 'Name is required' }
  }

  if (trimmed.length > 255) {
    return { valid: false, error: 'Name must be 255 characters or fewer' }
  }

  if (FORBIDDEN_CHARS.test(trimmed)) {
    return {
      valid: false,
      error: `Name cannot contain any of: ${FORBIDDEN_CHARS_DISPLAY}`,
    }
  }

  if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
    return { valid: false, error: 'Name cannot start or end with a dot' }
  }

  return { valid: true }
}

/**
 * Checks if a name conflicts with existing siblings (case-insensitive).
 * @param name - The name to check
 * @param siblings - All items under the same parent
 * @param excludeId - Optional ID to exclude from conflict check (for updates)
 */
export function checkNameConflict(
  name: string,
  siblings: Array<{ _id: SidebarItemId; name: string }>,
  excludeId?: SidebarItemId,
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
  itemId: SidebarItemId,
  newParentId: Id<'folders'> | null,
  getParent: (id: Id<'folders'>) => { parentId: Id<'folders'> | null } | undefined,
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

  const seen = new Set<Id<'folders'>>()
  let currentId: Id<'folders'> | null = newParentId

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
