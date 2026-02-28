import type { Doc, Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export interface DescendantItems {
  folders: Array<Doc<'folders'>>
  notes: Array<Doc<'notes'>>
  maps: Array<Doc<'gameMaps'>>
  files: Array<Doc<'files'>>
}

/**
 * Recursively collects all descendants of a folder, grouped by type.
 * Single source of truth for tree traversal — used by delete, trash, and download.
 *
 * By default queries only active (non-trashed) items (`trashed: false`).
 * Set `trashed: true` to collect trashed descendants (needed for restore / permanent delete).
 */
export async function collectDescendants(
  ctx: CampaignQueryCtx,
  {
    folderId,
    trashed = false,
  }: {
    folderId: Id<'folders'>
    trashed?: boolean
  },
): Promise<DescendantItems> {
  const campaignId = ctx.campaign._id
  const result: DescendantItems = {
    folders: [],
    notes: [],
    maps: [],
    files: [],
  }

  async function collectFromFolder(parentId: Id<'folders'>) {
    const [childFolders, childNotes, childMaps, childFiles] = trashed
      ? await Promise.all([
          ctx.db
            .query('folders')
            .withIndex('by_campaign_parent_deletionTime', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('parentId', parentId)
                .gt('deletionTime', 0),
            )
            .collect(),
          ctx.db
            .query('notes')
            .withIndex('by_campaign_parent_deletionTime', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('parentId', parentId)
                .gt('deletionTime', 0),
            )
            .collect(),
          ctx.db
            .query('gameMaps')
            .withIndex('by_campaign_parent_deletionTime', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('parentId', parentId)
                .gt('deletionTime', 0),
            )
            .collect(),
          ctx.db
            .query('files')
            .withIndex('by_campaign_parent_deletionTime', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('parentId', parentId)
                .gt('deletionTime', 0),
            )
            .collect(),
        ])
      : await Promise.all([
          ctx.db
            .query('folders')
            .withIndex('by_campaign_parent_name', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('deletionTime', undefined)
                .eq('parentId', parentId),
            )
            .collect(),
          ctx.db
            .query('notes')
            .withIndex('by_campaign_parent_name', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('deletionTime', undefined)
                .eq('parentId', parentId),
            )
            .collect(),
          ctx.db
            .query('gameMaps')
            .withIndex('by_campaign_parent_name', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('deletionTime', undefined)
                .eq('parentId', parentId),
            )
            .collect(),
          ctx.db
            .query('files')
            .withIndex('by_campaign_parent_name', (q) =>
              q
                .eq('campaignId', campaignId)
                .eq('deletionTime', undefined)
                .eq('parentId', parentId),
            )
            .collect(),
        ])

    result.notes.push(...childNotes)
    result.maps.push(...childMaps)
    result.files.push(...childFiles)

    for (const folder of childFolders) {
      result.folders.push(folder)
      await collectFromFolder(folder._id)
    }
  }

  await collectFromFolder(folderId)
  return result
}
