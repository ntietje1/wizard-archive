import { checkNameConflict, validateItemName } from 'convex/sidebarItems/validation/name'
import { CREATE_PARENT_TARGET_KIND } from 'convex/sidebarItems/validation/parent'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import type { CreateParentTarget } from 'convex/sidebarItems/validation/parent'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import type { ValidationResult } from 'convex/sidebarItems/validation/name'

const VIRTUAL_PARENT = Symbol('virtual-parent')

type ParentRef = Id<'sidebarItems'> | null | typeof VIRTUAL_PARENT

type ParentTargetValidationResult =
  | {
      valid: true
      parentId: Id<'sidebarItems'> | null
      siblings: Array<Pick<AnySidebarItem, '_id' | 'name'>>
    }
  | ({ valid: false } & Pick<Exclude<ValidationResult, { valid: true }>, 'error'>)

function buildParentStack(
  parentId: Id<'sidebarItems'> | null,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
): Array<Id<'sidebarItems'> | null> | null {
  const stack: Array<Id<'sidebarItems'> | null> = [null]
  if (parentId === null) return stack

  const chain: Array<Id<'sidebarItems'>> = []
  const seen = new Set<Id<'sidebarItems'>>()
  let currentId: Id<'sidebarItems'> | null = parentId

  while (currentId !== null) {
    if (seen.has(currentId)) return null
    seen.add(currentId)

    const currentItem = itemsMap.get(currentId)
    if (!currentItem) return null

    chain.unshift(currentId)
    currentId = currentItem.parentId
  }

  stack.push(...chain)
  return stack
}

function findSidebarChildByName(
  parentId: Id<'sidebarItems'> | null,
  name: string,
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>,
): AnySidebarItem | undefined {
  const normalizedName = name.trim().toLowerCase()

  return parentItemsMap.get(parentId)?.find((item) => {
    return item.name.trim().toLowerCase() === normalizedName
  })
}

export function validateCreateParentTarget(
  parentTarget: CreateParentTarget,
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>,
): ParentTargetValidationResult {
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    if (parentTarget.parentId !== null && !itemsMap.has(parentTarget.parentId)) {
      return { valid: false, error: 'Parent not found' }
    }

    return {
      valid: true,
      parentId: parentTarget.parentId,
      siblings: parentItemsMap.get(parentTarget.parentId) ?? [],
    }
  }

  const parentStack = buildParentStack(parentTarget.baseParentId, itemsMap)
  if (!parentStack) {
    return { valid: false, error: 'Parent not found' }
  }

  const traversalStack: Array<ParentRef> = [...parentStack]

  for (const segment of parentTarget.pathSegments) {
    const trimmedSegment = segment.trim()

    if (!trimmedSegment) {
      return { valid: false, error: 'Path segments cannot be empty' }
    }

    if (trimmedSegment === '.') {
      continue
    }

    if (trimmedSegment === '..') {
      if (traversalStack.length === 1) {
        return { valid: false, error: 'Path cannot traverse above the campaign root' }
      }

      traversalStack.pop()
      continue
    }

    const nameResult = validateItemName(trimmedSegment)
    if (!nameResult.valid) {
      return nameResult
    }

    const currentParent = traversalStack[traversalStack.length - 1]
    if (currentParent === VIRTUAL_PARENT) {
      traversalStack.push(VIRTUAL_PARENT)
      continue
    }

    const existingChild = findSidebarChildByName(currentParent, trimmedSegment, parentItemsMap)
    if (!existingChild) {
      traversalStack.push(VIRTUAL_PARENT)
      continue
    }

    if (existingChild.type !== SIDEBAR_ITEM_TYPES.folders) {
      return {
        valid: false,
        error: `"${trimmedSegment}" already exists here and is not a folder`,
      }
    }

    traversalStack.push(existingChild._id)
  }

  const resolvedParent = traversalStack[traversalStack.length - 1]
  if (resolvedParent === VIRTUAL_PARENT) {
    return {
      valid: true,
      parentId: null,
      siblings: [],
    }
  }

  return {
    valid: true,
    parentId: resolvedParent,
    siblings: parentItemsMap.get(resolvedParent) ?? [],
  }
}

export function validateCreateItemLocally(
  {
    name,
    parentTarget,
  }: {
    name: string
    parentTarget: CreateParentTarget
  },
  itemsMap: Map<Id<'sidebarItems'>, AnySidebarItem>,
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>,
): ValidationResult {
  const parentResult = validateCreateParentTarget(parentTarget, itemsMap, parentItemsMap)
  if (!parentResult.valid) {
    return parentResult
  }

  const trimmedName = name.trim()
  const nameResult = validateItemName(trimmedName)
  if (!nameResult.valid) {
    return nameResult
  }

  return checkNameConflict(trimmedName, parentResult.siblings)
}
