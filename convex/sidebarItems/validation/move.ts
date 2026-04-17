import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'
import { validateSidebarItemNameWithSiblings } from './name'
import { validateNoCircularParent } from './parent'
import type { ValidationResult } from './name'

type ParentLookup = Pick<AnySidebarItem, 'parentId'> | null | undefined
type SiblingLookup = Array<Pick<AnySidebarItem, '_id' | 'name'>>

export function validateLocalSidebarMove(
  {
    itemId,
    name,
    parentId,
    isTrashing = false,
    isRestoring = false,
  }: {
    itemId: Id<'sidebarItems'>
    name: string
    parentId?: Id<'sidebarItems'> | null
    isTrashing?: boolean
    isRestoring?: boolean
  },
  {
    getParent,
    getSiblings,
  }: {
    getParent: (id: Id<'sidebarItems'>) => ParentLookup
    getSiblings: (parentId: Id<'sidebarItems'> | null) => SiblingLookup
  },
): ValidationResult {
  if (isTrashing && isRestoring) {
    throw new Error('Cannot both trash and restore in the same operation')
  }

  if (parentId === undefined || isTrashing) {
    return { valid: true }
  }

  const parentResult = validateNoCircularParent(itemId, parentId, getParent)
  if (!parentResult.valid) {
    return {
      valid: false,
      error: 'Cannot move item: circular reference detected',
    }
  }

  if (isRestoring) {
    return { valid: true }
  }

  return validateSidebarItemNameWithSiblings(name, getSiblings(parentId), itemId)
}
