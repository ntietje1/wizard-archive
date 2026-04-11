import { asyncMap } from 'convex-helpers'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { hardDeleteTree } from './treeOperations'
import { hardDeleteItem } from './hardDeleteItem'
import { getSidebarItem } from './getSidebarItem'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'

export async function emptyTrashBin(ctx: CampaignMutationCtx): Promise<void> {
  const allTrashed = await ctx.db
    .query('sidebarItems')
    .withIndex('by_campaign_location_parent_name', (q) =>
      q.eq('campaignId', ctx.campaign._id).eq('location', SIDEBAR_ITEM_LOCATION.trash),
    )
    .collect()

  const trashedFolderIds = new Set(
    allTrashed.filter((i) => i.type === SIDEBAR_ITEM_TYPES.folders).map((f) => f._id),
  )
  const isRoot = (item: AnySidebarItemFromDb) =>
    !item.parentId || !trashedFolderIds.has(item.parentId)

  const enhanced = (await asyncMap(allTrashed, (raw) => getSidebarItem(ctx, raw._id))).filter(
    (item): item is NonNullable<typeof item> => item !== null,
  )

  const rootFolders = enhanced.filter((i) => i.type === SIDEBAR_ITEM_TYPES.folders && isRoot(i))
  const rootNonFolders = enhanced.filter((i) => i.type !== SIDEBAR_ITEM_TYPES.folders && isRoot(i))

  for (const folder of rootFolders) {
    await hardDeleteTree(ctx, folder)
  }

  for (const item of rootNonFolders) {
    await hardDeleteItem(ctx, item)
  }
}
