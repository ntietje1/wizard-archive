import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { applySidebarItemContentUpdate } from '../../sidebarItems/functions/applySidebarItemContentUpdate'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { commitUpload } from '../../storage/functions/commitUpload'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import type { EditHistoryChange } from '@wizard-archive/editor/resources/history-contract'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function applyMapImageUpdate(
  ctx: CampaignMutationCtx,
  {
    mapId,
    upload,
  }: {
    mapId: Id<'sidebarItems'>
    upload: Awaited<ReturnType<typeof commitUpload>> | null
  },
): Promise<{
  sidebarUpdates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>>
  changes: Array<EditHistoryChange>
}> {
  validateMapImageUpload(upload)
  const imageStorageId = upload?.storageId ?? null

  const ext = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
    .unique()
  if (ext) {
    await ctx.db.patch('gameMaps', ext._id, {
      imageReplacementToken: undefined,
      imageStorageId,
    })
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

function validateMapImageUpload(upload: Awaited<ReturnType<typeof commitUpload>> | null) {
  if (!upload) return
  if (!isMapImageFile(upload.metadata.contentType ?? null, upload.originalFileName)) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Only image files are allowed for maps')
  }
}

function isMapImageFile(contentType: string | null, fileName: string | null) {
  const lowerType = contentType?.toLowerCase()
  if (lowerType) return lowerType.startsWith('image/')
  if (!fileName) return false
  return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(fileName)
}

export async function updateMapImage(
  ctx: CampaignMutationCtx,
  {
    mapId,
    replacementToken,
    uploadSessionId,
  }: {
    mapId: Id<'sidebarItems'>
    replacementToken: string | null
    uploadSessionId: Id<'fileStorage'> | null
  },
): Promise<{ mapId: Id<'sidebarItems'> }> {
  const result = await applySidebarItemContentUpdate({
    ctx,
    itemId: mapId,
    itemType: RESOURCE_TYPES.gameMaps,
    notFoundMessage: 'Map not found',
    apply: async () => {
      if (!uploadSessionId) {
        return await applyMapImageUpdate(ctx, { mapId, upload: null })
      }
      const extension = await getMapExtension(ctx, mapId)
      if (!replacementToken || extension.imageReplacementToken !== replacementToken) {
        throwClientError(ERROR_CODE.CONFLICT, 'Stale map image replacement')
      }
      const upload = await commitUpload(ctx, { sessionId: uploadSessionId })
      return await applyMapImageUpdate(ctx, { mapId, upload })
    },
  })
  return { mapId: result.itemId }
}

export async function beginMapImageReplacement(
  ctx: CampaignMutationCtx,
  { mapId }: { mapId: Id<'sidebarItems'> },
) {
  const map = await getSidebarItem(ctx, mapId)
  if (!map || map.type !== RESOURCE_TYPES.gameMaps) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  }
  await requireItemAccess(ctx, { rawItem: map, requiredLevel: PERMISSION_LEVEL.EDIT })
  const extension = await getMapExtension(ctx, mapId)
  const replacementToken = crypto.randomUUID()
  await ctx.db.patch('gameMaps', extension._id, { imageReplacementToken: replacementToken })
  return replacementToken
}

async function getMapExtension(ctx: CampaignMutationCtx, mapId: Id<'sidebarItems'>) {
  const extension = await ctx.db
    .query('gameMaps')
    .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
    .unique()
  if (!extension) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  return extension
}
