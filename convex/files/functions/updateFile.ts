import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { applySidebarItemContentUpdate } from '../../sidebarItems/functions/applySidebarItemContentUpdate'
import { commitUpload } from '../../storage/functions/commitUpload'
import type { EditHistoryChange } from '@wizard-archive/editor/resources/history-contract'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function applyFileStorageUpdate(
  ctx: CampaignMutationCtx,
  {
    fileId,
    upload,
  }: {
    fileId: Id<'sidebarItems'>
    upload: Awaited<ReturnType<typeof commitUpload>> | null
  },
): Promise<{
  sidebarUpdates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>>
  changes: Array<EditHistoryChange>
}> {
  const storageId = upload?.storageId ?? null
  const ext = await ctx.db
    .query('files')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
    .unique()
  if (ext) {
    await ctx.db.patch('files', ext._id, { storageId })
  }

  if (upload) {
    const isImage = upload.metadata.contentType?.startsWith('image/') ?? false
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
    uploadSessionId,
  }: {
    fileId: Id<'sidebarItems'>
    uploadSessionId: Id<'fileStorage'> | null
  },
): Promise<{ fileId: Id<'sidebarItems'> }> {
  const result = await applySidebarItemContentUpdate({
    ctx,
    itemId: fileId,
    itemType: RESOURCE_TYPES.files,
    notFoundMessage: 'File not found',
    apply: async () => {
      const upload = uploadSessionId
        ? await commitUpload(ctx, { sessionId: uploadSessionId })
        : null
      return await applyFileStorageUpdate(ctx, { fileId, upload })
    },
  })
  return { fileId: result.itemId }
}
