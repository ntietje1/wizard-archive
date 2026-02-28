import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { requireItemAccess } from '../validation'
import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { SidebarItemId } from '../types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'

export async function permanentlyDeleteSidebarItem(
  ctx: CampaignMutationCtx,
  { itemId }: { itemId: SidebarItemId },
): Promise<void> {
  const item = await requireItemAccess(ctx, {
    rawItem: await ctx.db.get(itemId),
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  if (!item.deletionTime) {
    throw new Error('Item not found in trash')
  }

  if (
    item.type === SIDEBAR_ITEM_TYPES.folders &&
    ctx.membership.role !== CAMPAIGN_MEMBER_ROLE.DM
  ) {
    throw new Error('Only the DM can permanently delete folders')
  }

  await applyToTree(ctx, item, hardDeleteItem, { trashed: true })
}
