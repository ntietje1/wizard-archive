import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { SHARE_STATUS } from '../types'
import type { AuthQueryCtx } from '../../functions'
import type { Block } from '../../blocks/types'
import type { PermissionLevel } from '../../permissions/types'
import type { Id } from '../../_generated/dataModel'

async function getBlockPermissionLevel(
  ctx: AuthQueryCtx,
  { block }: { block: Block },
): Promise<PermissionLevel> {
  const { membership } = await requireCampaignMembership(ctx, block.campaignId)

  if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.EDIT
  }

  const checkId = membership._id
  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  switch (shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_LEVEL.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED: {
      const isShared: boolean = await isBlockSharedWithMember(ctx, {
        blockId: block._id,
        campaignMemberId: checkId,
        campaignId: block.campaignId,
      })
      return isShared ? PERMISSION_LEVEL.VIEW : PERMISSION_LEVEL.NONE
    }
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_LEVEL.NONE
  }
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: AuthQueryCtx,
  { block }: { block: Block },
): Promise<{ block: Block; permissionLevel: PermissionLevel } | null> {
  const permissionLevel = await getBlockPermissionLevel(ctx, { block })
  if (permissionLevel === PERMISSION_LEVEL.NONE) {
    return null
  }

  return { block, permissionLevel }
}

async function isBlockSharedWithMember(
  ctx: AuthQueryCtx,
  {
    blockId,
    campaignMemberId,
    campaignId,
  }: {
    blockId: Id<'blocks'>
    campaignMemberId: Id<'campaignMembers'>
    campaignId: Id<'campaigns'>
  },
): Promise<boolean> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .filter((q) => q.eq(q.field('deletionTime'), null))
    .first()

  return share !== null
}
