import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { getSidebarItem } from './getSidebarItem'
import { requireItemAccess } from '../validation/access'
import type { EditHistoryChange } from '../../../shared/edit-history/types'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { SidebarItemType } from '../../../shared/sidebar-items/types'
import type { AnySidebarItem } from '../../../shared/sidebar-items/model-types'

export async function applySidebarItemContentUpdate({
  ctx,
  itemId,
  itemType,
  notFoundMessage,
  apply,
}: {
  ctx: CampaignMutationCtx
  itemId: Id<'sidebarItems'>
  itemType: SidebarItemType
  notFoundMessage: string
  apply: (item: AnySidebarItem) => Promise<{
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
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  const { sidebarUpdates, changes } = await apply(item)

  if (changes.length === 0) return { itemId: item._id }

  await ctx.db.patch('sidebarItems', itemId, {
    ...sidebarUpdates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: item._id,
    itemType,
    changes,
  })

  return { itemId: item._id }
}
