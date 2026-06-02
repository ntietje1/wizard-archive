import type { SidebarItemId } from '../common/ids'
import type { AnySidebarItem } from './model-types'
import { isPromiseLike } from '../common/async'
import type { MaybePromise } from '../common/async'
import { assertSidebarItemName, checkNameConflict, validateItemName } from './name'
import { SIDEBAR_ITEM_TYPES } from './types'
import type { SidebarItemName, ValidationResult } from './name'

export const CREATE_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

type BaseCreateParentTarget<TSegment> =
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.direct
      parentId: SidebarItemId | null
    }
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.path
      baseParentId: SidebarItemId | null
      pathSegments: Array<TSegment>
    }

export type CreateParentTarget = BaseCreateParentTarget<string>

type ParentPathSegment = SidebarItemName | '.' | '..'

export type ParsedCreateParentTarget = BaseCreateParentTarget<ParentPathSegment>

const VIRTUAL_PARENT = Symbol('virtual-parent')

type ParentRef = SidebarItemId | null | typeof VIRTUAL_PARENT
type ParentLookup = { parentId: SidebarItemId | null } | null | undefined
type ParentTargetValidationResult =
  | {
      valid: true
      parentId: SidebarItemId | null
      siblings: Array<{ _id: SidebarItemId; name: string }>
    }
  | ({ valid: false } & Pick<Exclude<ValidationResult, { valid: true }>, 'error'>)

function requireParentPathSegment(segment: string): ParentPathSegment {
  const trimmedSegment = segment.trim()

  if (!trimmedSegment) {
    throw new Error('Path segments cannot be empty')
  }

  if (trimmedSegment === '.' || trimmedSegment === '..') {
    return trimmedSegment
  }

  return assertSidebarItemName(trimmedSegment)
}

export function requireCreateParentTarget(
  parentTarget: CreateParentTarget,
): ParsedCreateParentTarget {
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    return parentTarget
  }

  return {
    kind: CREATE_PARENT_TARGET_KIND.path,
    baseParentId: parentTarget.baseParentId,
    pathSegments: parentTarget.pathSegments.map(requireParentPathSegment),
  }
}

function validateNoCircularParentInternal(
  itemId: SidebarItemId,
  newParentId: SidebarItemId | null,
  getParent: (id: SidebarItemId) => MaybePromise<ParentLookup>,
): MaybePromise<ValidationResult> {
  if (!newParentId) {
    return { valid: true }
  }

  if (newParentId === itemId) {
    return {
      valid: false,
      error: 'An item cannot be its own parent',
    }
  }

  const seen = new Set<SidebarItemId>()

  const visit = (currentId: SidebarItemId | null): MaybePromise<ValidationResult> => {
    if (!currentId) {
      return { valid: true }
    }

    if (seen.has(currentId)) {
      return { valid: true }
    }
    seen.add(currentId)

    if (currentId === itemId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current = getParent(currentId)
    if (isPromiseLike(current)) {
      return current.then((value) => visit(value?.parentId ?? null))
    }

    return visit(current?.parentId ?? null)
  }

  return visit(newParentId)
}

export function validateNoCircularParent(
  itemId: SidebarItemId,
  newParentId: SidebarItemId | null,
  getParent: (id: SidebarItemId) => ParentLookup,
): ValidationResult {
  const result = validateNoCircularParentInternal(itemId, newParentId, getParent)
  if (isPromiseLike(result)) {
    throw new Error('Invariant: synchronous parent lookup returned a Promise')
  }

  return result
}

export async function validateNoCircularParentAsync(
  itemId: SidebarItemId,
  newParentId: SidebarItemId | null,
  getParent: (id: SidebarItemId) => MaybePromise<ParentLookup>,
): Promise<ValidationResult> {
  return await validateNoCircularParentInternal(itemId, newParentId, getParent)
}

export function getAncestorIds(
  itemId: SidebarItemId,
  getParent: (id: SidebarItemId) => ParentLookup,
): Array<SidebarItemId> {
  const ancestors: Array<SidebarItemId> = []
  const seen = new Set<SidebarItemId>()
  let currentId = getParent(itemId)?.parentId ?? null

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId)
    ancestors.push(currentId)
    currentId = getParent(currentId)?.parentId ?? null
  }

  return ancestors
}

function buildParentStack(
  parentId: SidebarItemId | null,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
): Array<SidebarItemId | null> | null {
  const stack: Array<SidebarItemId | null> = [null]
  if (parentId === null) return stack

  const chain: Array<SidebarItemId> = []
  const seen = new Set<SidebarItemId>()
  let currentId: SidebarItemId | null = parentId

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
  parentId: SidebarItemId | null,
  name: string,
  parentItemsMap: Map<SidebarItemId | null, Array<AnySidebarItem>>,
): AnySidebarItem | undefined {
  const normalizedName = name.trim().toLowerCase()

  return parentItemsMap.get(parentId)?.find((item) => {
    return item.name.trim().toLowerCase() === normalizedName
  })
}

export function validateCreateParentTarget(
  parentTarget: CreateParentTarget,
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
  parentItemsMap: Map<SidebarItemId | null, Array<AnySidebarItem>>,
): ParentTargetValidationResult {
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    if (parentTarget.parentId !== null) {
      const parentItem = itemsMap.get(parentTarget.parentId)
      if (!parentItem) {
        return { valid: false, error: 'Parent not found' }
      }
      if (parentItem.type !== SIDEBAR_ITEM_TYPES.folders) {
        return { valid: false, error: 'Parent must be a folder' }
      }
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
  if (parentTarget.baseParentId !== null) {
    const baseParent = itemsMap.get(parentTarget.baseParentId)
    if (!baseParent) {
      return { valid: false, error: 'Parent not found' }
    }
    if (baseParent.type !== SIDEBAR_ITEM_TYPES.folders) {
      return { valid: false, error: 'Parent is not a folder' }
    }
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
  itemsMap: Map<SidebarItemId, AnySidebarItem>,
  parentItemsMap: Map<SidebarItemId | null, Array<AnySidebarItem>>,
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
