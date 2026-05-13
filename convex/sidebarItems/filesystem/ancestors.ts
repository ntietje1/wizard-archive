import { ERROR_CODE, throwClientError } from '../../errors'
import { getSidebarItem } from '../functions/getSidebarItem'
import type { QueryCtx } from '../../_generated/server'
import type { Id } from '../../_generated/dataModel'
import type { AnySidebarItem } from '../types/types'

export async function addSidebarItemAncestorsToMap<
  T extends Pick<AnySidebarItem, '_id' | 'parentId'>,
>(
  ctx: Pick<QueryCtx, 'db'>,
  {
    items,
    itemsById,
    maxDepth,
  }: {
    items: Array<T>
    itemsById: Map<Id<'sidebarItems'>, Pick<AnySidebarItem, '_id' | 'parentId'>>
    maxDepth: number
  },
): Promise<void> {
  for (const item of items) {
    let parentId = item.parentId
    let depth = 0
    while (parentId) {
      if (depth >= maxDepth) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar ancestor depth exceeded')
      }
      const existingParent = itemsById.get(parentId)
      if (existingParent) {
        parentId = existingParent.parentId
        depth += 1
        continue
      }
      const parent = await getSidebarItem(ctx, parentId)
      if (!parent) {
        throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item ancestor not found')
      }
      itemsById.set(parent._id, parent)
      parentId = parent.parentId
      depth += 1
    }
  }
}
