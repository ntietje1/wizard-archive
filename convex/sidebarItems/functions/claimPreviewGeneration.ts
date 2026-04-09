import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { ERROR_CODE, throwClientError } from '../../errors'
import { requireCampaignMembership } from '../../functions'
import { requireItemAccess } from '../validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import type { AuthMutationCtx } from '../../functions'
import type { SidebarItemId } from '../types/baseTypes'

const LEASE_DURATION_MS = 60_000
export const COOLDOWN_MS = 5 * 60_000

export async function claimPreviewGeneration(
  ctx: AuthMutationCtx,
  { itemId }: { itemId: SidebarItemId },
): Promise<{ claimed: boolean; claimToken: string | null }> {
  // eslint-disable-next-line @convex-dev/explicit-table-ids
  const item = await ctx.db.get(itemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'Item not found')
  await requireCampaignMembership(ctx, item.campaignId)
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
  // eslint-disable-next-line @convex-dev/explicit-table-ids
  await ctx.db.patch(itemId, {
    previewLockedUntil: now + LEASE_DURATION_MS,
    previewClaimToken: claimToken,
  })
  return { claimed: true, claimToken }
}
