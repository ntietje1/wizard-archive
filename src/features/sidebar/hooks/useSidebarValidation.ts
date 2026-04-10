import {
  checkNameConflict,
  validateItemName,
  validateNoCircularParent,
} from 'convex/sidebarItems/sharedValidation'
import { findUniqueDefaultName } from 'convex/sidebarItems/functions/defaultItemName'
import type { SidebarItemType } from 'convex/sidebarItems/types/baseTypes'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ValidationResult } from 'convex/sidebarItems/sharedValidation'
import { useActiveSidebarItems } from '~/features/sidebar/hooks/useSidebarItems'

export interface SidebarValidation {
  getSiblings: (parentId: Id<'sidebarItems'> | null) => Array<AnySidebarItem>
  validateName: (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => ValidationResult
  canMoveToParent: (itemId: Id<'sidebarItems'>, newParentId: Id<'sidebarItems'> | null) => boolean
  getDefaultName: (type: SidebarItemType, parentId: Id<'sidebarItems'> | null) => string
}

export function useSidebarValidation(): SidebarValidation {
  const { itemsMap, parentItemsMap } = useActiveSidebarItems()

  const getSiblings = (parentId: Id<'sidebarItems'> | null) => {
    return parentItemsMap.get(parentId) ?? []
  }

  const validateName = (
    name: string,
    parentId: Id<'sidebarItems'> | null,
    excludeId?: Id<'sidebarItems'>,
  ) => {
    const trimmed = name.trim()
    const nameResult = validateItemName(trimmed)
    if (!nameResult.valid) return nameResult
    return checkNameConflict(trimmed, getSiblings(parentId), excludeId)
  }

  const canMoveToParent = (itemId: Id<'sidebarItems'>, newParentId: Id<'sidebarItems'> | null) => {
    return validateNoCircularParent(itemId, newParentId, (id) => itemsMap.get(id)).valid
  }

  const getDefaultName = (type: SidebarItemType, parentId: Id<'sidebarItems'> | null) => {
    return findUniqueDefaultName(type, getSiblings(parentId))
  }

  return { getSiblings, validateName, canMoveToParent, getDefaultName }
}
