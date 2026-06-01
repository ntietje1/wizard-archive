import { v } from 'convex/values'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import {
  CREATE_PARENT_TARGET_KIND,
  requireCreateParentTarget as requireSharedCreateParentTarget,
} from '../../../shared/sidebar-items/parent-target'
import type {
  CreateParentTarget,
  ParsedCreateParentTarget,
} from '../../../shared/sidebar-items/parent-target'

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

export function requireCreateParentTarget(
  parentTarget: CreateParentTarget,
): ParsedCreateParentTarget {
  try {
    return requireSharedCreateParentTarget(parentTarget)
  } catch (error) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      error instanceof Error ? error.message : 'Invalid parent target',
    )
  }
}
