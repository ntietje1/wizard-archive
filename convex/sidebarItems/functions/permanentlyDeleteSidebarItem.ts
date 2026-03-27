import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { requireItemAccess } from '../validation'
import { requireCampaignMembership } from '../../functions'
import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { SidebarItemId } from '../types/baseTypes'
import type { AuthMutationCtx } from '../../functions'

export async function permanentlyDeleteSidebarItem(
  ctx: AuthMutationCtx,
  { itemId }: { itemId: SidebarItemId },
): Promise<void> {
  const item = await requireItemAccess(ctx, {
    rawItem: await ctx.db.get(itemId),
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  if (item.location !== SIDEBAR_ITEM_LOCATION.trash) {
    throwClientError(
      ERROR_CODE.NOT_FOUND,
      'This item is no longer in the trash',
    )
  }

  const { membership } = await requireCampaignMembership(ctx, item.campaignId)
  if (
    item.type === SIDEBAR_ITEM_TYPES.folders &&
    membership.role !== CAMPAIGN_MEMBER_ROLE.DM
  ) {
    throwClientError(
      ERROR_CODE.PERMISSION_DENIED,
      'Only the DM can permanently delete folders',
    )
  }

  await applyToTree(ctx, item, hardDeleteItem)
}
