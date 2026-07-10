import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItem } from './getSidebarItem'
import { requireItemAccess } from '../validation/access'
import type { EditHistoryChange } from '@wizard-archive/editor/resources/history-contract'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { AnyResource, ResourceKind } from '@wizard-archive/editor/resources/resource-contract'

export async function applySidebarItemContentUpdate({
  ctx,
  itemId,
  itemType,
  notFoundMessage,
  apply,
}: {
  ctx: CampaignMutationCtx
  itemId: Id<'sidebarItems'>
  itemType: ResourceKind
  notFoundMessage: string
  apply: (item: AnyResource) => Promise<{
    sidebarUpdates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>>
    changes: Array<EditHistoryChange>
  }>
}): Promise<{ itemId: Id<'sidebarItems'> }> {
  const rawItem = await getSidebarItem(ctx, itemId)
  if (!rawItem || rawItem.type !== itemType) {
    throwClientError(ERROR_CODE.NOT_FOUND, notFoundMessage)
  }

  const item = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })
  const { sidebarUpdates, changes } = await apply(item)

  if (changes.length === 0) return { itemId: item.id }

  await ctx.db.patch('sidebarItems', itemId, {
    ...sidebarUpdates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item.id,
    itemType,
    changes,
  })

  return { itemId: item.id }
}
