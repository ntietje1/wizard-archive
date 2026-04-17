import { v } from 'convex/values'
import type { Id } from '../../_generated/dataModel'
import { ERROR_CODE, throwClientError } from '../../errors'
import { requireSidebarItemName } from './name'
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

export function validateNoCircularParent(
  itemId: Id<'sidebarItems'>,
  newParentId: Id<'sidebarItems'> | null,
  getParent: (id: Id<'sidebarItems'>) => { parentId: Id<'sidebarItems'> | null } | undefined,
): ValidationResult {
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
  let currentId: Id<'sidebarItems'> | null = newParentId

  while (currentId) {
    if (seen.has(currentId)) {
      break
    }
    seen.add(currentId)

    if (currentId === itemId) {
      return {
        valid: false,
        error: 'This move would create a circular reference',
      }
    }

    const current = getParent(currentId)
    currentId = current?.parentId ?? null
  }

  return { valid: true }
}
