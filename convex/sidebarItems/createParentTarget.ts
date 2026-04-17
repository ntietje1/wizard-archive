import { v } from 'convex/values'
import type { Id } from '../_generated/dataModel'

export const CREATE_PARENT_TARGET_KIND = {
  direct: 'direct',
  path: 'path',
} as const

export type CreateParentTarget =
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.direct
      parentId: Id<'sidebarItems'> | null
    }
  | {
      kind: typeof CREATE_PARENT_TARGET_KIND.path
      baseParentId: Id<'sidebarItems'> | null
      pathSegments: Array<string>
    }

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
