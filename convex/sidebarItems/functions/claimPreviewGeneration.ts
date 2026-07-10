import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { requireItemAccess } from '../validation/access'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { getSidebarItem } from './getSidebarItem'
import {
  createPreviewClaimToken,
  getPreviewClaimContentVersion,
  getPreviewContentVersion,
  isPreviewCurrent,
  PREVIEW_CLAIM_UNAVAILABLE_REASON,
  PREVIEW_GENERATION_COOLDOWN_MS,
} from '../previewGeneration'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PreviewGenerationClaim } from '../previewGeneration'
import { getPreviewLease, replacePreviewLease } from '../previewLease'

const LEASE_DURATION_MS = 60_000

export async function claimPreviewGeneration(
  ctx: CampaignMutationCtx,
  { itemId }: { itemId: Id<'sidebarItems'> },
): Promise<PreviewGenerationClaim> {
  const item = await getSidebarItem(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })
  const storedItem = await ctx.db.get('sidebarItems', itemId)
  if (!storedItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')

  if (item.type === RESOURCE_TYPES.folders) {
    return { status: 'unavailable', reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.unsupported }
  }

  const now = Date.now()
  const contentVersion = getPreviewContentVersion(storedItem)
  const lease = await getPreviewLease(ctx, itemId)

  if (
    lease &&
    lease.lockedUntil > now &&
    getPreviewClaimContentVersion(lease.claimToken) === contentVersion
  ) {
    return {
      status: 'unavailable',
      reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.generationInProgress,
    }
  }

  if (
    isPreviewCurrent(storedItem) &&
    storedItem.previewUpdatedAt !== null &&
    now - storedItem.previewUpdatedAt < PREVIEW_GENERATION_COOLDOWN_MS
  ) {
    return { status: 'unavailable', reason: PREVIEW_CLAIM_UNAVAILABLE_REASON.current }
  }

  const claimToken = createPreviewClaimToken(contentVersion)
  await replacePreviewLease(ctx, {
    sidebarItemId: itemId,
    lockedUntil: now + LEASE_DURATION_MS,
    claimToken,
  })
  return { status: 'claimed', claimToken }
}
