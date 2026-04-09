import { ERROR_CODE, throwClientError } from '../../errors'
import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { hasAtLeastPermissionLevel } from '../../permissions/hasAtLeastPermissionLevel'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { requireCampaignMembership } from '../../functions'
import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { SidebarItemId } from '../types/baseTypes'
import type { AuthMutationCtx } from '../../functions'

export async function permanentlyDeleteSidebarItem(
  ctx: AuthMutationCtx,
  { itemId }: { itemId: SidebarItemId },
): Promise<void> {
  const rawItem = await ctx.db.get(itemId)
  if (!rawItem) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  }

  if (rawItem.location !== SIDEBAR_ITEM_LOCATION.trash) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item is no longer in the trash')
  }

  const { membership } = await requireCampaignMembership(ctx, rawItem.campaignId)

  if (membership.role !== CAMPAIGN_MEMBER_ROLE.DM) {
    if (rawItem.type === SIDEBAR_ITEM_TYPES.folders) {
      throwClientError(ERROR_CODE.PERMISSION_DENIED, 'Only the DM can permanently delete folders')
    }

    const share = await ctx.db
      .query('sidebarItemShares')
      .withIndex('by_campaign_item_member', (q) =>
        q
          .eq('campaignId', rawItem.campaignId)
          .eq('sidebarItemId', itemId)
          .eq('campaignMemberId', membership._id),
      )
      .first()

    const level = share?.permissionLevel ?? PERMISSION_LEVEL.NONE
    if (!hasAtLeastPermissionLevel(level, PERMISSION_LEVEL.FULL_ACCESS)) {
      throwClientError(
        ERROR_CODE.PERMISSION_DENIED,
        'You do not have sufficient permission for this item',
      )
    }
  }

  await applyToTree(ctx, rawItem, hardDeleteItem)
}
