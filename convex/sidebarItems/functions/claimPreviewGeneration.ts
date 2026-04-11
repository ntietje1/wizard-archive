import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { ERROR_CODE, throwClientError } from '../../errors'
import { requireItemAccess } from '../validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { getSidebarItem } from './getSidebarItem'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

const LEASE_DURATION_MS = 60_000
export const COOLDOWN_MS = 5 * 60_000

export async function claimPreviewGeneration(
  ctx: CampaignMutationCtx,
  { itemId }: { itemId: Id<'sidebarItems'> },
): Promise<{ claimed: boolean; claimToken: string | null }> {
  const item = await getSidebarItem(ctx, itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.EDIT,
  })

  if (item.type === SIDEBAR_ITEM_TYPES.folders) {
    return { claimed: false, claimToken: null }
  }

  const now = Date.now()

  if (item.previewLockedUntil && item.previewLockedUntil > now) {
    return { claimed: false, claimToken: null }
  }

  if (item.previewUpdatedAt && now - item.previewUpdatedAt < COOLDOWN_MS) {
    return { claimed: false, claimToken: null }
  }

  const claimToken = crypto.randomUUID()
  await ctx.db.patch('sidebarItems', itemId, {
    previewLockedUntil: now + LEASE_DURATION_MS,
    previewClaimToken: claimToken,
  })
  return { claimed: true, claimToken }
}
