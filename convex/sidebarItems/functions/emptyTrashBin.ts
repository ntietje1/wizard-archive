import { requireDmRole } from '../../functions'
import { SIDEBAR_ITEM_LOCATION } from '../types/baseTypes'
import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { AnySidebarItemFromDb } from '../types/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

/**
 * Permanently deletes all trashed items in the campaign in a single mutation.
 * Only root-level trashed items need explicit tree walks — their descendants
 * are handled by `applyToTree`.
 */
export async function emptyTrashBin(
  ctx: AuthMutationCtx,
  { campaignId }: { campaignId: Id<'campaigns'> },
): Promise<void> {
  await requireDmRole(ctx, campaignId)

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', SIDEBAR_ITEM_LOCATION.trash),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', SIDEBAR_ITEM_LOCATION.trash),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', SIDEBAR_ITEM_LOCATION.trash),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', SIDEBAR_ITEM_LOCATION.trash),
      )
      .collect(),
  ])

  // Items whose parent is also trashed will be handled by applyToTree
  // when processing the parent folder, so we only need root-level items.
  const trashedFolderIds = new Set(folders.map((f) => f._id))
  const isRoot = (item: AnySidebarItemFromDb) =>
    !item.parentId || !trashedFolderIds.has(item.parentId)

  const rootFolders = (folders as Array<AnySidebarItemFromDb>).filter(isRoot)
  const rootNonFolders = (
    [...notes, ...maps, ...files] as Array<AnySidebarItemFromDb>
  ).filter(isRoot)

  // Delete root folders (applyToTree handles their descendants)
  for (const folder of rootFolders) {
    await applyToTree(ctx, folder, hardDeleteItem)
  }

  // Delete root non-folder items directly
  for (const item of rootNonFolders) {
    await hardDeleteItem(ctx, item)
  }
}
