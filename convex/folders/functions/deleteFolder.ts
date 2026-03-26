import { deleteFile } from '../../files/functions/deleteFile'
import { deleteMap } from '../../gameMaps/functions/deleteMap'
import { deleteNote } from '../../notes/functions/deleteNote'
import { deleteSidebarItemShares } from '../../sidebarShares/functions/sidebarItemShareMutations'
import { deleteItemBookmarks } from '../../bookmarks/functions/deleteItemBookmarks'
import { requireItemAccess } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireDmRole } from '../../functions'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function deleteFolder(
  ctx: AuthMutationCtx,
  { folderId }: { folderId: Id<'folders'> },
): Promise<Id<'folders'>> {
  const folderFromDb = await ctx.db.get(folderId)
  if (!folderFromDb) throw new Error('Folder not found')
  const campaignId = folderFromDb.campaignId
  await requireDmRole(ctx, campaignId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const location = folderFromDb.location

  const [childFolders, childNotes, childMaps, childFiles] = await Promise.all([
    ctx.db
      .query('folders')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', location)
          .eq('parentId', folderId),
      )
      .collect(),
    ctx.db
      .query('notes')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', location)
          .eq('parentId', folderId),
      )
      .collect(),
    ctx.db
      .query('gameMaps')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', location)
          .eq('parentId', folderId),
      )
      .collect(),
    ctx.db
      .query('files')
      .withIndex('by_campaign_location_parent_name', (q) =>
        q
          .eq('campaignId', campaignId)
          .eq('location', location)
          .eq('parentId', folderId),
      )
      .collect(),
  ])

  for (const childFolder of childFolders) {
    await deleteFolder(ctx, { folderId: childFolder._id })
  }

  for (const childNote of childNotes) {
    await deleteNote(ctx, { noteId: childNote._id })
  }

  for (const childMap of childMaps) {
    await deleteMap(ctx, { mapId: childMap._id })
  }

  for (const childFile of childFiles) {
    await deleteFile(ctx, { fileId: childFile._id })
  }

  await deleteSidebarItemShares(ctx, { sidebarItemId: folderId })
  await deleteItemBookmarks(ctx, { sidebarItemId: folderId })
  await ctx.db.delete(folderId)

  return folder._id
}
