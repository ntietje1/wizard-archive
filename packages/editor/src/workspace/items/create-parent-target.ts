import type { ResourceId } from '../../resources/domain-id'
import type { AnyItem, CreateParentTarget, ValidationResult } from '../items'
import {
  CREATE_PARENT_TARGET_KIND,
  canonicalizeResourceItemTitle,
  isActiveResourceItem,
  validateResourceTitle,
} from '../items'
import { RESOURCE_TYPES } from '../items-persistence-contract'

const VIRTUAL_PARENT = Symbol('virtual-parent')

type ParentRef = ResourceId | null | typeof VIRTUAL_PARENT
type CreateParentTargetItem = Pick<AnyItem, 'id' | 'name' | 'parentId' | 'status' | 'type'>

export type CreateParentTargetValidationSource<TItem extends CreateParentTargetItem = AnyItem> = {
  getItemById: (itemId: ResourceId) => TItem | null | undefined
  getActiveChildren: (parentId: ResourceId | null) => ReadonlyArray<TItem>
}

type ParentTargetValidationResult<TItem extends CreateParentTargetItem = AnyItem> =
  | {
      valid: true
      parentId: ResourceId | null
      siblings: ReadonlyArray<TItem>
    }
  | ({ valid: false } & Pick<Exclude<ValidationResult, { valid: true }>, 'error'>)

type CreateParentPathPlanEntry =
  | { kind: 'existing'; id: ResourceId }
  | { kind: 'virtual'; name: string }

type CreateParentTargetPlan =
  | { kind: typeof CREATE_PARENT_TARGET_KIND.direct; parentId: ResourceId | null }
  | { kind: typeof CREATE_PARENT_TARGET_KIND.path; folders: Array<CreateParentPathPlanEntry> }

type PendingCreateParentFolderResolver = (input: {
  name: string
  parentId: ResourceId | null
}) => ResourceId | null | undefined

type ParentStackResult =
  | { valid: true; stack: Array<ResourceId | null> }
  | { valid: false; error: string }

function buildParentStack(
  parentId: ResourceId | null,
  source: CreateParentTargetValidationSource,
): ParentStackResult {
  const stack: Array<ResourceId | null> = [null]
  if (parentId === null) return { valid: true, stack }

  const chain: Array<ResourceId> = []
  const seen = new Set<ResourceId>()
  let currentId: ResourceId | null = parentId

  while (currentId !== null) {
    if (seen.has(currentId)) return { valid: false, error: 'Parent not found' }
    seen.add(currentId)

    const currentItem = source.getItemById(currentId)
    if (!currentItem || !isActiveResourceItem(currentItem)) {
      return { valid: false, error: 'Parent not found' }
    }
    if (currentItem.type !== RESOURCE_TYPES.folders) {
      return { valid: false, error: 'Parent is not a folder' }
    }

    chain.unshift(currentId)
    currentId = currentItem.parentId
  }

  stack.push(...chain)
  return { valid: true, stack }
}

function findSidebarChildByName(
  parentId: ResourceId | null,
  name: string,
  source: CreateParentTargetValidationSource,
): CreateParentTargetItem | undefined {
  const title = canonicalizeResourceItemTitle(name)

  return source.getActiveChildren(parentId).find((item) => {
    return isActiveResourceItem(item) && canonicalizeResourceItemTitle(item.name) === title
  })
}

export function validateCreateParentTarget(
  parentTarget: CreateParentTarget,
  source: CreateParentTargetValidationSource,
): ParentTargetValidationResult {
  return parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct
    ? validateDirectCreateParentTarget(parentTarget, source)
    : validatePathCreateParentTarget(parentTarget, source)
}

export function planCreateParentTarget(
  parentTarget: CreateParentTarget,
  source: CreateParentTargetValidationSource,
  options: {
    createdFolderIds?: ReadonlySet<ResourceId>
    resolvePendingFolder?: PendingCreateParentFolderResolver
  } = {},
): CreateParentTargetPlan | null {
  if (
    parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct &&
    parentTarget.parentId !== null &&
    options.createdFolderIds?.has(parentTarget.parentId)
  ) {
    return { kind: CREATE_PARENT_TARGET_KIND.direct, parentId: parentTarget.parentId }
  }
  const hasPendingPathBase =
    parentTarget.kind === CREATE_PARENT_TARGET_KIND.path &&
    parentTarget.baseParentId !== null &&
    options.createdFolderIds?.has(parentTarget.baseParentId)

  if (!hasPendingPathBase) {
    const validation = validateCreateParentTarget(parentTarget, source)
    if (!validation.valid) return null
  }
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    return { kind: CREATE_PARENT_TARGET_KIND.direct, parentId: parentTarget.parentId }
  }

  const folders = planCreateParentPath(parentTarget, source, {
    createdFolderIds: options.createdFolderIds,
    resolvePendingFolder: options.resolvePendingFolder,
  })
  return folders ? { kind: CREATE_PARENT_TARGET_KIND.path, folders } : null
}

function validateDirectCreateParentTarget(
  parentTarget: Extract<CreateParentTarget, { kind: typeof CREATE_PARENT_TARGET_KIND.direct }>,
  source: CreateParentTargetValidationSource,
): ParentTargetValidationResult {
  if (parentTarget.parentId !== null) {
    const parentItem = source.getItemById(parentTarget.parentId)
    if (!parentItem || !isActiveResourceItem(parentItem)) {
      return { valid: false, error: 'Parent not found' }
    }
    if (parentItem.type !== RESOURCE_TYPES.folders) {
      return { valid: false, error: 'Parent must be a folder' }
    }
  }

  return {
    valid: true,
    parentId: parentTarget.parentId,
    siblings: source.getActiveChildren(parentTarget.parentId),
  }
}

function validatePathCreateParentTarget(
  parentTarget: Extract<CreateParentTarget, { kind: typeof CREATE_PARENT_TARGET_KIND.path }>,
  source: CreateParentTargetValidationSource,
): ParentTargetValidationResult {
  const parentStackResult = buildParentStack(parentTarget.baseParentId, source)
  if (!parentStackResult.valid) {
    return parentStackResult
  }

  const baseParentResult = validatePathBaseParent(parentTarget.baseParentId, source)
  if (!baseParentResult.valid) {
    return baseParentResult
  }

  const traversalStack: Array<ParentRef> = [...parentStackResult.stack]

  for (const segment of parentTarget.pathSegments) {
    const segmentResult = applyPathSegment(traversalStack, segment, source)
    if (!segmentResult.valid) {
      return segmentResult
    }
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
    siblings: source.getActiveChildren(resolvedParent),
  }
}

function validatePathBaseParent(
  baseParentId: ResourceId | null,
  source: CreateParentTargetValidationSource,
): ValidationResult {
  if (baseParentId === null) return { valid: true }
  const baseParent = source.getItemById(baseParentId)
  if (!baseParent || !isActiveResourceItem(baseParent)) {
    return { valid: false, error: 'Parent not found' }
  }
  if (baseParent.type !== RESOURCE_TYPES.folders) {
    return { valid: false, error: 'Parent is not a folder' }
  }
  return { valid: true }
}

function planCreateParentPath(
  parentTarget: Extract<CreateParentTarget, { kind: typeof CREATE_PARENT_TARGET_KIND.path }>,
  source: CreateParentTargetValidationSource,
  options: {
    createdFolderIds: ReadonlySet<ResourceId> | undefined
    resolvePendingFolder: PendingCreateParentFolderResolver | undefined
  },
): Array<CreateParentPathPlanEntry> | null {
  const path = planBaseCreateParentPath(parentTarget, source, options.createdFolderIds)
  if (!path) return null

  for (const rawSegment of parentTarget.pathSegments) {
    const segmentApplied = applyCreateParentPathSegment(
      path,
      rawSegment,
      source,
      options.resolvePendingFolder,
    )
    if (!segmentApplied) return null
  }

  return path
}

function planBaseCreateParentPath(
  parentTarget: Extract<CreateParentTarget, { kind: typeof CREATE_PARENT_TARGET_KIND.path }>,
  source: CreateParentTargetValidationSource,
  createdFolderIds: ReadonlySet<ResourceId> | undefined,
): Array<CreateParentPathPlanEntry> | null {
  if (parentTarget.baseParentId !== null && createdFolderIds?.has(parentTarget.baseParentId)) {
    return [{ kind: 'existing', id: parentTarget.baseParentId }]
  }

  const parentStackResult = buildParentStack(parentTarget.baseParentId, source)
  if (!parentStackResult.valid) return null

  return parentStackResult.stack.flatMap((id) => (id === null ? [] : [{ kind: 'existing', id }]))
}

function applyCreateParentPathSegment(
  path: Array<CreateParentPathPlanEntry>,
  rawSegment: string,
  source: CreateParentTargetValidationSource,
  resolvePendingFolder: PendingCreateParentFolderResolver | undefined,
) {
  const segment = rawSegment.trim()
  if (!segment || segment === '.') return true
  if (segment === '..') return removeLastCreateParentPathEntry(path)
  if (!validateResourceTitle(segment).valid) return false

  path.push(planNamedCreateParentPathEntry(path, segment, source, resolvePendingFolder))
  return true
}

function removeLastCreateParentPathEntry(path: Array<CreateParentPathPlanEntry>) {
  if (path.length === 0) return false
  path.pop()
  return true
}

function planNamedCreateParentPathEntry(
  path: ReadonlyArray<CreateParentPathPlanEntry>,
  name: string,
  source: CreateParentTargetValidationSource,
  resolvePendingFolder: PendingCreateParentFolderResolver | undefined,
): CreateParentPathPlanEntry {
  const parentEntry = path[path.length - 1]
  const parentId =
    !parentEntry || parentEntry.kind === 'existing' ? (parentEntry?.id ?? null) : undefined
  const existingFolder =
    parentId === undefined
      ? undefined
      : (findSidebarChildByName(parentId, name, source)?.id ??
        resolvePendingFolder?.({ parentId, name }))
  return existingFolder ? { kind: 'existing', id: existingFolder } : { kind: 'virtual', name }
}

function applyPathSegment(
  traversalStack: Array<ParentRef>,
  segment: string,
  source: CreateParentTargetValidationSource,
): ValidationResult {
  const trimmedSegment = segment.trim()

  if (!trimmedSegment) {
    return { valid: false, error: 'Path segments cannot be empty' }
  }
  if (trimmedSegment === '.') {
    return { valid: true }
  }
  if (trimmedSegment === '..') {
    return applyParentTraversalSegment(traversalStack)
  }

  return applyNamedPathSegment(traversalStack, trimmedSegment, source)
}

function applyParentTraversalSegment(traversalStack: Array<ParentRef>): ValidationResult {
  if (traversalStack.length === 1) {
    return { valid: false, error: 'Path cannot traverse above the workspace root' }
  }
  traversalStack.pop()
  return { valid: true }
}

function applyNamedPathSegment(
  traversalStack: Array<ParentRef>,
  segment: string,
  source: CreateParentTargetValidationSource,
): ValidationResult {
  const titleResult = validateResourceTitle(segment)
  if (!titleResult.valid) {
    return titleResult
  }

  const currentParent = traversalStack[traversalStack.length - 1]
  if (currentParent === VIRTUAL_PARENT) {
    traversalStack.push(VIRTUAL_PARENT)
    return { valid: true }
  }

  const existingChild = findSidebarChildByName(currentParent, segment, source)
  if (!existingChild) {
    traversalStack.push(VIRTUAL_PARENT)
    return { valid: true }
  }

  if (existingChild.type !== RESOURCE_TYPES.folders) {
    return {
      valid: false,
      error: `"${segment}" already exists here and is not a folder`,
    }
  }

  traversalStack.push(existingChild.id)
  return { valid: true }
}
