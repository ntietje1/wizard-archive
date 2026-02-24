import type { Id } from '../_generated/dataModel'
import type { SidebarItemId } from './types/baseTypes'

export interface ValidationResult {
  valid: boolean
  error?: string
}

/**
 * Validates that a name is compatible with wiki-link syntax.
 * Names cannot contain [ ] # | as these are wiki-link delimiters/modifiers.
 */
export function validateWikiLinkCompatibleName(
  name: string | undefined,
): ValidationResult {
  if (!name) return { valid: true }

  if (name.includes('[')) {
    return {
      valid: false,
      error: 'Name cannot contain "[" as it conflicts with wiki-link syntax',
    }
  }
  if (name.includes(']')) {
    return {
      valid: false,
      error: 'Name cannot contain "]" as it conflicts with wiki-link syntax',
    }
  }
  if (name.includes('#')) {
    return {
      valid: false,
      error:
        'Name cannot contain "#" as it conflicts with wiki-link heading syntax',
    }
  }
  if (name.includes('|')) {
    return {
      valid: false,
      error:
        'Name cannot contain "|" as it conflicts with wiki-link display name syntax',
    }
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
  name: string | undefined,
  siblings: Array<{ _id: SidebarItemId; name?: string }>,
  excludeId?: SidebarItemId,
): ValidationResult {
  if (!name || name.trim() === '') {
    return { valid: true }
  }

  const conflict = siblings.find(
    (item) =>
      item.name?.toLowerCase() === name.toLowerCase() && item._id !== excludeId,
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
  newParentId: Id<'folders'> | undefined,
  getParent: (id: Id<'folders'>) => { parentId?: Id<'folders'> } | undefined,
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
  let currentId: Id<'folders'> | undefined = newParentId

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
    currentId = current?.parentId
  }

  return { valid: true }
}
