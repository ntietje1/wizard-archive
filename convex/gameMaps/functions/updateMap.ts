import { EDIT_HISTORY_ACTION } from '../../../shared/edit-history/types'
import { SIDEBAR_ITEM_TYPES } from '../../../shared/sidebar-items/types'
import { applySidebarItemContentUpdate } from '../../sidebarItems/functions/applySidebarItemContentUpdate'
import type { EditHistoryChange } from '../../../shared/edit-history/types'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function applyMapImageUpdate(
  ctx: CampaignMutationCtx,
  {
    mapId,
    imageStorageId,
  }: {
    mapId: Id<'sidebarItems'>
    imageStorageId: Id<'_storage'> | null
  },
): Promise<{
  sidebarUpdates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>>
  changes: Array<EditHistoryChange>
}> {
  const ext = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
    .unique()
  if (ext) {
    await ctx.db.patch('gameMaps', ext._id, { imageStorageId })
  }

  return {
    sidebarUpdates: { previewStorageId: imageStorageId },
    changes: [
      {
        action:
          imageStorageId !== null
            ? EDIT_HISTORY_ACTION.map_image_changed
            : EDIT_HISTORY_ACTION.map_image_removed,
        metadata: null,
      },
    ],
  }
}

export async function updateMapImage(
  ctx: CampaignMutationCtx,
  {
    mapId,
    imageStorageId,
  }: {
    mapId: Id<'sidebarItems'>
    imageStorageId: Id<'_storage'> | null
  },
): Promise<{ mapId: Id<'sidebarItems'> }> {
  const result = await applySidebarItemContentUpdate({
    ctx,
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    notFoundMessage: 'Map not found',
    apply: async (item) => {
      return imageStorageId === item.previewStorageId
        ? { sidebarUpdates: {}, changes: [] }
        : await applyMapImageUpdate(ctx, { mapId, imageStorageId })
    },
  })
  return { mapId: result.itemId }
}
