import {
  checkNameConflict,
  validateItemName,
  validateNoCircularParent,
} from 'convex/sidebarItems/sharedValidation'
import { findUniqueDefaultName } from 'convex/sidebarItems/functions/defaultItemName'
import type {
  SidebarItemId,
  SidebarItemType,
} from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import { useAllSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

export interface SidebarValidation {
  getSiblings: (parentId: Id<'folders'> | null) => Array<AnySidebarItem>
  validateName: (
    name: string,
    parentId: Id<'folders'> | null,
    excludeId?: SidebarItemId,
  ) => ValidationResult
  canMoveToParent: (
    itemId: SidebarItemId,
    newParentId: Id<'folders'> | null,
  ) => boolean
  getDefaultName: (
    type: SidebarItemType,
    parentId: Id<'folders'> | null,
  ) => string
}

export function useSidebarValidation(): SidebarValidation {
  const { itemsMap, parentItemsMap } = useAllSidebarItems()

  const getSiblings = (parentId: Id<'folders'> | null) => {
    return parentItemsMap.get(parentId) ?? []
  }

  const validateName = (
    name: string,
    parentId: Id<'folders'> | null,
    excludeId?: SidebarItemId,
  ) => {
    const trimmed = name.trim()
    const nameResult = validateItemName(trimmed)
    if (!nameResult.valid) return nameResult
    return checkNameConflict(trimmed, getSiblings(parentId), excludeId)
  }

  const canMoveToParent = (
    itemId: SidebarItemId,
    newParentId: Id<'folders'> | null,
  ) => {
    return validateNoCircularParent(itemId, newParentId, (id) =>
      itemsMap.get(id),
    ).valid
  }

  const getDefaultName = (
    type: SidebarItemType,
    parentId: Id<'folders'> | null,
  ) => {
    return findUniqueDefaultName(type, getSiblings(parentId))
  }

  return { getSiblings, validateName, canMoveToParent, getDefaultName }
}
