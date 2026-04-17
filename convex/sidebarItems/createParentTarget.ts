import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'
import { ERROR_CODE, throwClientError } from '../errors'
import {
  requireSidebarItemName,
} from './sharedValidation'
import type { SidebarItemName } from './sharedValidation'

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

export function requireCreateParentTarget(parentTarget: CreateParentTarget): ParsedCreateParentTarget {
  if (parentTarget.kind === CREATE_PARENT_TARGET_KIND.direct) {
    return parentTarget
  }

  return {
    kind: CREATE_PARENT_TARGET_KIND.path,
    baseParentId: parentTarget.baseParentId,
    pathSegments: parentTarget.pathSegments.map(requireParentPathSegment),
  }
}
