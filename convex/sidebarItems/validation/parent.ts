import { v } from 'convex/values'
import { ERROR_CODE } from '../../../shared/errors/client'
import type { SidebarItemId } from '../../../shared/common/ids'
import { throwClientError } from '../../errors'
import type { ResourceParentTarget } from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_PARENT_TARGET_KIND } from '@wizard-archive/editor/resources/resource-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'

type ParentPathSegment = ResourceTitle | '.' | '..'

export type ParsedCreateParentTarget =
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.direct
      parentId: SidebarItemId | null
    }
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.path
      baseParentId: SidebarItemId | null
      pathSegments: Array<ParentPathSegment>
    }

export const createParentTargetValidator = v.union(
  v.object({
    kind: v.literal(RESOURCE_PARENT_TARGET_KIND.direct),
    parentId: v.nullable(v.id('sidebarItems')),
  }),
  v.object({
    kind: v.literal(RESOURCE_PARENT_TARGET_KIND.path),
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
    throw new Error('Path segments cannot be empty')
  }

  if (trimmedSegment === '.' || trimmedSegment === '..') {
    return trimmedSegment
  }

  return canonicalizeResourceTitle(trimmedSegment)
}

export function requireCreateParentTarget(
  parentTarget: ResourceParentTarget,
): ParsedCreateParentTarget {
  try {
    if (parentTarget.kind === RESOURCE_PARENT_TARGET_KIND.direct) {
      return parentTarget
    }

    return {
      kind: RESOURCE_PARENT_TARGET_KIND.path,
      baseParentId: parentTarget.baseParentId,
      pathSegments: parentTarget.pathSegments.map(requireParentPathSegment),
    }
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid parent target',
    )
  }
}
