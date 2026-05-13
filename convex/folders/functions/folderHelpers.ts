import { SIDEBAR_ITEM_STATUS, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function findSidebarChildByName(
  ctx: CampaignMutationCtx,
  {
    parentId,
    name,
  }: {
    parentId: Id<'sidebarItems'> | null
    name: SidebarItemName
  },
): Promise<Doc<'sidebarItems'> | null> {
  const normalizedName = name.toLowerCase()
  const siblings = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_status_parent_name_deletionTime', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('status', SIDEBAR_ITEM_STATUS.active)
        .eq('parentId', parentId),
    )
    .collect()

  return siblings.find((item) => item.name.trim().toLowerCase() === normalizedName) ?? null
}

export async function createFolderCompanion(
  ctx: CampaignMutationCtx,
  { folderId }: { folderId: Id<'sidebarItems'> },
): Promise<void> {
  await ctx.db.insert('folders', {
    sidebarItemId: folderId,
    inheritShares: false,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    action: EDIT_HISTORY_ACTION.created,
  })
}
