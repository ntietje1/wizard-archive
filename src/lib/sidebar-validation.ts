import {
  checkNameConflict,
  validateNoCircularParent as validateNoCircularParentShared,
  validateWikiLinkCompatibleName,
} from 'convex/sidebarItems/sharedValidation'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import type { Id } from 'convex/_generated/dataModel'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'

export type { ValidationResult }
export { validateWikiLinkCompatibleName, checkNameConflict }

/**
 * Checks if setting a new parent would create a circular reference.
 * Client version using itemsMap for synchronous parent chain lookup.
 */
export function validateNoCircularParent(
  itemId: SidebarItemId,
  newParentId: Id<'folders'> | undefined,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): ValidationResult {
  return validateNoCircularParentShared(itemId, newParentId, (id) =>
    itemsMap.get(id),
  )
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

  const ancestors: Array<Id<'folders'>> = []
  const seen = new Set<Id<'folders'>>()
  let currentId = item.parentId ?? undefined

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    ancestors.push(currentId)
    const current = itemsMap.get(currentId)
    currentId = current?.parentId ?? undefined
  }

  return ancestors
}

export interface SidebarItemValidationOptions {
  name?: string
  parentId?: Id<'folders'>
  itemId?: SidebarItemId
  siblings?: Array<AnySidebarItem>
  itemsMap?: Map<SidebarItemId, AnySidebarItem>
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

  const wikiLinkResult = validateWikiLinkCompatibleName(name)
  if (!wikiLinkResult.valid) {
    return wikiLinkResult
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
