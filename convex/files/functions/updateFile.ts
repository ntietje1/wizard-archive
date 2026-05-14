import { ERROR_CODE, throwClientError } from '../../errors'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { applySidebarItemContentUpdate } from '../../sidebarItems/functions/applySidebarItemContentUpdate'
import type { EditHistoryChange } from '../../editHistory/types'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function applyFileStorageUpdate(
  ctx: CampaignMutationCtx,
  {
    fileId,
    storageId,
  }: {
    fileId: Id<'sidebarItems'>
    storageId: Id<'_storage'> | null
  },
): Promise<{
  sidebarUpdates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>>
  changes: Array<EditHistoryChange>
}> {
  const ext = await ctx.db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
    .unique()
  if (ext) {
    await ctx.db.patch('files', ext._id, { storageId })
  }

  if (storageId) {
    const metadata = await ctx.db.system.get('_storage', storageId)
    if (!metadata) {
      throwClientError(ERROR_CODE.NOT_FOUND, `Storage object ${storageId} not found`)
    }
    const isImage = metadata.contentType?.startsWith('image/') ?? false
    return {
      sidebarUpdates: {
        previewStorageId: isImage ? storageId : null,
        previewUpdatedAt: isImage ? Date.now() : null,
      },
      changes: [{ action: EDIT_HISTORY_ACTION.file_replaced, metadata: null }],
    }
  }

  return {
    sidebarUpdates: {
      previewStorageId: null,
      previewUpdatedAt: null,
    },
    changes: [{ action: EDIT_HISTORY_ACTION.file_removed, metadata: null }],
  }
}

export async function updateFileStorage(
  ctx: CampaignMutationCtx,
  {
    fileId,
    storageId,
  }: {
    fileId: Id<'sidebarItems'>
    storageId: Id<'_storage'> | null
  },
): Promise<{ fileId: Id<'sidebarItems'> }> {
  const result = await applySidebarItemContentUpdate({
    ctx,
    itemId: fileId,
    itemType: SIDEBAR_ITEM_TYPES.files,
    notFoundMessage: 'File not found',
    apply: () => applyFileStorageUpdate(ctx, { fileId, storageId }),
  })
  return { fileId: result.itemId }
}
