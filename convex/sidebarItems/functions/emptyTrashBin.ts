import { applyToTree } from './applyToTree'
import { hardDeleteItem } from './hardDeleteItem'
import type { AnySidebarItemFromDb } from '../types/types'
import type { CampaignMutationCtx } from '../../functions'

/**
 * Permanently deletes all trashed items in the campaign in a single mutation.
 * Only root-level trashed items need explicit tree walks — their descendants
 * are handled by `applyToTree`.
 */
export async function emptyTrashBin(ctx: CampaignMutationCtx): Promise<void> {
  const campaignId = ctx.campaign._id

  const [folders, notes, maps, files] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_deletionTime', (q) =>
        q.eq('campaignId', campaignId).gt('deletionTime', 0),
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
    await applyToTree(ctx, folder, hardDeleteItem, { trashed: true })
  }

  // Delete root non-folder items directly
  for (const item of rootNonFolders) {
    await hardDeleteItem(ctx, item)
  }
}
