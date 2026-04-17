import { v } from 'convex/values'
import type { Id } from '../../_generated/dataModel'
import { ERROR_CODE, throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { checkNameConflict, requireSidebarItemName, validateItemName } from './name'
import type { AnySidebarItem } from '../types/types'
import type { SidebarItemName, ValidationResult } from './name'

export const CREATE_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

type BaseCreateParentTarget<TSegment> =
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.direct
      parentId: Id<'sidebarItems'> | null
    }
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.path
      baseParentId: Id<'sidebarItems'> | null
      pathSegments: Array<TSegment>
    }

export type CreateParentTarget = BaseCreateParentTarget<string>

export type ParentPathSegment = SidebarItemName | '.' | '..'

export type ParsedCreateParentTarget = BaseCreateParentTarget<ParentPathSegment>

export type CreateItemParentArgs = {
  parentTarget: CreateParentTarget
}

export const createParentTargetValidator = v.union(
  v.object({
    kind: v.literal(CREATE_PARENT_TARGET_KIND.direct),
    parentId: v.nullable(v.id('sidebarItems')),
  }),
  v.object({
    kind: v.literal(CREATE_PARENT_TARGET_KIND.path),
    baseParentId: v.nullable(v.id('sidebarItems')),
    pathSegments: v.array(v.string()),
  }),
)

export const createItemParentArgsValidator = {
  parentTarget: createParentTargetValidator,
} as const

const VIRTUAL_PARENT = Symbol('virtual-parent')

type ParentRef = Id<'sidebarItems'> | null | typeof VIRTUAL_PARENT
type ParentLookup = { parentId: Id<'sidebarItems'> | null } | null | undefined
type MaybePromise<T> = T | Promise<T>
type ParentTargetValidationResult =
  | {
      valid: true
      parentId: Id<'sidebarItems'> | null
      siblings: Array<Pick<AnySidebarItem, '_id' | 'name'>>
    }
  | ({ valid: false } & Pick<Exclude<ValidationResult, { valid: true }>, 'error'>)

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}

function requireParentPathSegment(segment: string): ParentPathSegment {
  const trimmedSegment = segment.trim()

  if (!trimmedSegment) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Path segments cannot be empty')
  }

  if (trimmedSegment === '.' || trimmedSegment === '..') {
    return trimmedSegment
  }

  return requireSidebarItemName(trimmedSegment)
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
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  getParent: (id: Id<'sidebarItems'>) => MaybePromise<ParentLookup>,
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

  const seen = new Set<Id<'sidebarItems'>>()

  const visit = (currentId: Id<'sidebarItems'> | null): MaybePromise<ValidationResult> => {
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
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  getParent: (id: Id<'sidebarItems'>) => ParentLookup,
): ValidationResult {
  const result = validateNoCircularParentInternal(itemId, newParentId, getParent)
  if (isPromiseLike(result)) {
    throw new Error('Invariant: synchronous parent lookup returned a Promise')
  }

  return result
}

export async function validateNoCircularParentAsync(
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  getParent: (id: Id<'sidebarItems'>) => MaybePromise<ParentLookup>,
): Promise<ValidationResult> {
  return await validateNoCircularParentInternal(itemId, newParentId, getParent)
}

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
