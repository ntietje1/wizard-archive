import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { requireItemAccess } from '../validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { logger } from '../../common/logger'
import { getSidebarItem } from './getSidebarItem'
import { commitUpload } from '../../storage/functions/commitUpload'
import { isStorageReferencedByCampaignContent } from '../../storage/functions/storageReferences'
import { getPreviewClaimContentVersion, getPreviewContentVersion } from '../previewGeneration'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PreviewPublicationResult } from '../previewGeneration'
import { deletePreviewLease, getPreviewLease } from '../previewLease'

export async function setPreviewImage(
  ctx: CampaignMutationCtx,
  {
    itemId,
    uploadSessionId,
    claimToken,
  }: {
    itemId: Id<'sidebarItems'>
    uploadSessionId: Id<'fileStorage'>
    claimToken: string
  },
): Promise<PreviewPublicationResult> {
  const item = await getSidebarItem(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (item.type === RESOURCE_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders do not support preview images')
  }

  const storedItem = await ctx.db.get('sidebarItems', itemId)
  if (!storedItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  const lease = await getPreviewLease(ctx, itemId)

  const claimContentVersion = getPreviewClaimContentVersion(claimToken)
  if (
    claimContentVersion !== null &&
    claimContentVersion !== getPreviewContentVersion(storedItem)
  ) {
    return { status: 'stale' }
  }

  if (
    claimContentVersion === null ||
    !lease ||
    lease.claimToken !== claimToken ||
    lease.lockedUntil < Date.now()
  ) {
    throwClientError(ERROR_CODE.CONFLICT, 'Invalid or expired claim token')
  }

  const upload = await commitUpload(ctx, { sessionId: uploadSessionId })
  const previewStorageId = upload.storageId

  const oldPreviewStorageId = storedItem?.previewStorageId ?? null

  await ctx.db.patch('sidebarItems', itemId, {
    previewStorageId,
    previewUpdatedAt: Date.now(),
  })
  await deletePreviewLease(ctx, itemId)

  if (oldPreviewStorageId && oldPreviewStorageId !== previewStorageId) {
    try {
      if (!(await isStorageReferencedByCampaignContent(ctx.db, oldPreviewStorageId))) {
        await ctx.storage.delete(oldPreviewStorageId)
      }
    } catch (error) {
      logger.error('Failed to delete old preview storage', {
        oldPreviewStorageId,
        previewStorageId,
        error,
      })
    }
  }

  return { status: 'published' }
}
