import { requireCampaignMembership } from '../functions'
import type { AuthMutationCtx } from '../functions'
import type { Id } from '../_generated/dataModel'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../sidebarItems/types/baseTypes'
import type { EditHistoryAction } from './types'

export async function logEditHistory(
  ctx: AuthMutationCtx,
  {
    itemId,
    itemType,
    campaignId,
    action,
    metadata,
  }: {
    itemId: SidebarItemId
    itemType: SidebarItemType
    campaignId: Id<'campaigns'>
    action: EditHistoryAction
    metadata?: Record<string, unknown> | null
  },
): Promise<void> {
  const { membership } = await requireCampaignMembership(ctx, campaignId)

  await ctx.db.insert('editHistory', {
    itemId,
    itemType,
    campaignId,
    campaignMemberId: membership._id,
    action,
    metadata: metadata ?? null,
  })
}
