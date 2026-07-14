import { v } from 'convex/values'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { DOMAIN_ID_KIND, assertDomainId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceId } from '@wizard-archive/editor/resources/domain-id'
import type { ResourceParentTarget } from '@wizard-archive/editor/resources/resource-contract'
import { RESOURCE_PARENT_TARGET_KIND } from '@wizard-archive/editor/resources/resource-contract'
import { canonicalizeResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import type { ResourceTitle } from '@wizard-archive/editor/resources/resource-record'
import { resourceIdValidator } from '../../resources/validators'

type ParentPathSegment = ResourceTitle | '.' | '..'

export type ParsedCreateParentTarget =
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.direct
      parentId: ResourceId | null
    }
  | {
      kind: typeof RESOURCE_PARENT_TARGET_KIND.path
      baseParentId: ResourceId | null
      pathSegments: Array<ParentPathSegment>
    }

export const createParentTargetValidator = v.union(
  v.object({
    kind: v.literal(RESOURCE_PARENT_TARGET_KIND.direct),
    parentId: v.nullable(resourceIdValidator),
  }),
  v.object({
    kind: v.literal(RESOURCE_PARENT_TARGET_KIND.path),
    baseParentId: v.nullable(resourceIdValidator),
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
      return {
        kind: RESOURCE_PARENT_TARGET_KIND.direct,
        parentId:
          parentTarget.parentId === null
            ? null
            : assertDomainId(DOMAIN_ID_KIND.resource, parentTarget.parentId),
      }
    }

    return {
      kind: RESOURCE_PARENT_TARGET_KIND.path,
      baseParentId:
        parentTarget.baseParentId === null
          ? null
          : assertDomainId(DOMAIN_ID_KIND.resource, parentTarget.baseParentId),
      pathSegments: parentTarget.pathSegments.map(requireParentPathSegment),
    }
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid parent target',
    )
  }
}
