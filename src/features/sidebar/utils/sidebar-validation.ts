import {
  checkNameConflict,
  validateItemName,
  validateNoCircularParent as validateNoCircularParentShared,
} from 'convex/sidebarItems/sharedValidation'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import type { Id } from 'convex/_generated/dataModel'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

/**
 * Checks if setting a new parent would create a circular reference.
 * Client version using itemsMap for synchronous parent chain lookup.
 */
export function validateNoCircularParent(
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): ValidationResult {
  return validateNoCircularParentShared(itemId, newParentId, (id) => itemsMap.get(id))
}

/**
 * Gets all ancestor IDs for an item (for circular reference detection).
 * Handles potential cycles by tracking seen IDs.
 */
export function getAncestorIds(
  itemId: Id<'sidebarItems'>,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): Array<Id<'sidebarItems'>> {
  const item = itemsMap.get(itemId)
  if (!item) return []

  const ancestors: Array<Id<'sidebarItems'>> = []
  const seen = new Set<Id<'sidebarItems'>>()
  let currentId = item.parentId

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    ancestors.push(currentId)
    const current = itemsMap.get(currentId)
    currentId = current?.parentId ?? null
  }

  return ancestors
}

export interface SidebarItemValidationOptions {
  name: string
  parentId: Id<'sidebarItems'> | null
  itemId?: Id<'sidebarItems'>
  siblings?: Array<AnySidebarItem>
  itemsMap?: Map<Id<'sidebarItems'>, AnySidebarItem>
  isMove?: boolean
}

/**
 * Validates a sidebar item name for create/update operations.
 * Combines wiki-link and name conflict validation.
 */
export function validateSidebarItemName(
  options: Pick<SidebarItemValidationOptions, 'name' | 'siblings' | 'itemId'>,
): ValidationResult {
  const { name, siblings, itemId } = options

  const nameResult = validateItemName(name)
  if (!nameResult.valid) {
    return nameResult
  }

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
  options: Pick<SidebarItemValidationOptions, 'itemId' | 'parentId' | 'itemsMap'>,
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
export function validateSidebarItem(options: SidebarItemValidationOptions): ValidationResult {
  const { name, parentId, itemId, siblings, itemsMap, isMove } = options

  const nameResult = validateSidebarItemName({ name, siblings, itemId })
  if (!nameResult.valid) {
    return nameResult
  }

  if (isMove && itemId && itemsMap) {
    const parentResult = validateParentChange({ itemId, parentId, itemsMap })
    if (!parentResult.valid) {
      return parentResult
    }
  }

  return { valid: true }
}
