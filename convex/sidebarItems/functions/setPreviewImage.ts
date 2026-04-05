import { ERROR_CODE, throwClientError } from '../../errors'
import { requireCampaignMembership } from '../../functions'
import { requireItemAccess } from '../validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { SidebarItemId } from '../types/baseTypes'

export async function setPreviewImage(
  ctx: AuthMutationCtx,
  {
    itemId,
    previewStorageId,
  }: {
    itemId: SidebarItemId
    previewStorageId: Id<'_storage'>
  },
): Promise<void> {
  const item = await ctx.db.get(itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireCampaignMembership(ctx, item.campaignId)
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  const oldPreviewStorageId = item.previewStorageId
  if (oldPreviewStorageId && oldPreviewStorageId !== previewStorageId) {
    await ctx.storage.delete(oldPreviewStorageId)
  }

  await ctx.db.patch(itemId, {
    previewStorageId,
    previewUpdatedAt: Date.now(),
    previewLockedUntil: null,
  })
}
