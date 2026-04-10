import { ERROR_CODE, throwClientError } from '../../errors'
import { requireCampaignMembership } from '../../functions'
import { requireItemAccess } from '../validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { logger } from '../../common/logger'
import { getSidebarItem } from './getSidebarItem'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../types/baseTypes'

export async function setPreviewImage(
  ctx: AuthMutationCtx,
  {
    itemId,
    previewStorageId,
    claimToken,
  }: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
    claimToken: string
  },
): Promise<void> {
  const item = await getSidebarItem(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireCampaignMembership(ctx, item.campaignId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Folders do not support preview images')
  }

  if (
    !item.previewClaimToken ||
    item.previewClaimToken !== claimToken ||
    !item.previewLockedUntil ||
    item.previewLockedUntil < Date.now()
  ) {
    throwClientError(ERROR_CODE.CONFLICT, 'Invalid or expired claim token')
  }

  const storageUrl = await ctx.storage.getUrl(previewStorageId)
  if (!storageUrl) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Storage object not found')
  }

  const oldPreviewStorageId = item.previewStorageId

  await ctx.db.patch('sidebarItems', itemId, {
    previewStorageId,
    previewUpdatedAt: Date.now(),
    previewLockedUntil: null,
    previewClaimToken: null,
  })

  if (oldPreviewStorageId && oldPreviewStorageId !== previewStorageId) {
    try {
      await ctx.storage.delete(oldPreviewStorageId)
    } catch (error) {
      logger.error('Failed to delete old preview storage', {
        oldPreviewStorageId,
        previewStorageId,
        error,
      })
    }
  }
}
