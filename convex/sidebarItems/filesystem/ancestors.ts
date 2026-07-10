import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItemRow } from './sidebarItemRows'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { AnyResource } from '@wizard-archive/editor/resources/resource-contract'

export async function loadSidebarItemAncestorMap<T extends Pick<AnyResource, 'id' | 'parentId'>>(
  ctx: CampaignQueryCtx,
  {
    items,
    itemsById,
    maxDepth,
  }: {
    items: ReadonlyArray<T>
    itemsById: ReadonlyMap<Id<'sidebarItems'>, Pick<AnyResource, 'id' | 'parentId'>>
    maxDepth: number
  },
): Promise<Map<Id<'sidebarItems'>, Pick<AnyResource, 'id' | 'parentId'>>> {
  const ancestorItemsById = new Map(itemsById)

  for (const item of items) {
    let parentId = item.parentId
    let depth = 0
    while (parentId) {
      if (depth >= maxDepth) {
        throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Max sidebar ancestor depth exceeded')
      }
      const existingParent = ancestorItemsById.get(parentId)
      if (existingParent) {
        parentId = existingParent.parentId
        depth += 1
        continue
      }
      const parent = await getSidebarItemRow(ctx, parentId)
      if (!parent) {
        throwClientError(ERROR_CODE.NOT_FOUND, 'Sidebar item ancestor not found')
      }
      ancestorItemsById.set(parent._id, { id: parent._id, parentId: parent.parentId })
      parentId = parent.parentId
      depth += 1
    }
  }

  return ancestorItemsById
}
