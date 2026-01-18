import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'

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
      error: 'Name cannot contain "#" as it conflicts with wiki-link heading syntax',
    }
  }
  if (name.includes('|')) {
    return {
      valid: false,
      error: 'Name cannot contain "|" as it conflicts with wiki-link display name syntax',
    }
  }
  return { valid: true }
}

/**
 * Checks if a name conflicts with existing items under the same parent.
 * @param name - The name to check
 * @param siblings - All items under the same parent
 * @param excludeId - Optional ID to exclude from conflict check (for updates)
 */
export function checkNameConflict(
  name: string | undefined,
  siblings: Array<AnySidebarItem>,
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
 * @param itemsMap - Map of all items by ID
 * @returns ValidationResult indicating if the move is valid
 */
export function validateNoCircularParent(
  itemId: SidebarItemId,
  newParentId: SidebarItemId | undefined,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): ValidationResult {
  // Moving to root is always valid
  if (!newParentId) {
    return { valid: true }
  }

  // Can't set parent to self
  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  // Walk up the parent chain from newParentId to check for cycles
  const seen = new Set<SidebarItemId>()
  let currentId: SidebarItemId | undefined = newParentId

  while (currentId) {
    if (seen.has(currentId)) {
      // Already in a cycle in the existing data (shouldn't happen)
      break
    }
    seen.add(currentId)

    if (currentId === itemId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current = itemsMap.get(currentId)
    currentId = current?.parentId
  }

  return { valid: true }
}

/**
 * Gets all ancestor IDs for an item (for circular reference detection).
 * Handles potential cycles by tracking seen IDs.
 */
export function getAncestorIds(
  itemId: SidebarItemId,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): Array<SidebarItemId> {
  const item = itemsMap.get(itemId)
  if (!item) return []

  const ancestors: Array<SidebarItemId> = []
  const seen = new Set<SidebarItemId>()
  let currentId = item.parentId

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    ancestors.push(currentId)
    const current = itemsMap.get(currentId)
    currentId = current?.parentId
  }

  return ancestors
}

export interface SidebarItemValidationOptions {
  name?: string
  parentId?: SidebarItemId
  itemId?: SidebarItemId // For updates, the item being updated
  siblings?: Array<AnySidebarItem> // Items under the same parent
  itemsMap?: Map<SidebarItemId, AnySidebarItem> // For circular reference detection
  isMove?: boolean // True if this is a move operation
}

/**
 * Validates a sidebar item name for create/update operations.
 * Combines wiki-link and name conflict validation.
 */
export function validateSidebarItemName(
  options: Pick<SidebarItemValidationOptions, 'name' | 'siblings' | 'itemId'>,
): ValidationResult {
  const { name, siblings, itemId } = options

  // Check wiki link compatibility
  const wikiLinkResult = validateWikiLinkCompatibleName(name)
  if (!wikiLinkResult.valid) {
    return wikiLinkResult
  }

  // Check name conflicts if siblings provided
  if (siblings) {
    const conflictResult = checkNameConflict(name, siblings, itemId)
    if (!conflictResult.valid) {
      return conflictResult
    }
  }

  return { valid: true }
}

/**
 * Validates a parent change (move operation).
 * Checks for circular references.
 */
export function validateParentChange(
  options: Pick<
    SidebarItemValidationOptions,
    'itemId' | 'parentId' | 'itemsMap'
  >,
): ValidationResult {
  const { itemId, parentId, itemsMap } = options

  if (!itemId || !itemsMap) {
    return { valid: true }
  }

  return validateNoCircularParent(itemId, parentId, itemsMap)
}

/**
 * Combined validation for sidebar item operations.
 * Use this for comprehensive validation on create/update/move.
 */
export function validateSidebarItem(
  options: SidebarItemValidationOptions,
): ValidationResult {
  const { name, parentId, itemId, siblings, itemsMap, isMove } = options

  // Validate name
  const nameResult = validateSidebarItemName({ name, siblings, itemId })
  if (!nameResult.valid) {
    return nameResult
  }

  // Validate parent change if this is a move or if parentId is changing
  if (isMove && itemId && itemsMap) {
    const parentResult = validateParentChange({ itemId, parentId, itemsMap })
    if (!parentResult.valid) {
      return parentResult
    }
  }

  return { valid: true }
}
