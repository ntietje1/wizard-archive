import { CAMPAIGN_MEMBER_ROLE } from '../../campaigns/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SHARE_STATUS } from '../types'
import type { CampaignQueryCtx } from '../../functions'
import type { Block } from '../../blocks/types'
import type { PermissionLevel } from '../../permissions/types'
import type { Id } from '../../_generated/dataModel'

export async function getBlockPermissionLevel(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<PermissionLevel> {
  const checkId = ctx.membership._id

  if (ctx.membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return PERMISSION_LEVEL.EDIT
  }

  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  switch (shareStatus) {
    case SHARE_STATUS.ALL_SHARED:
      return PERMISSION_LEVEL.VIEW
    case SHARE_STATUS.INDIVIDUALLY_SHARED: {
      const isShared: boolean = await isBlockSharedWithMember(ctx, {
        blockId: block._id,
        campaignMemberId: checkId,
      })
      return isShared ? PERMISSION_LEVEL.VIEW : PERMISSION_LEVEL.NONE
    }
    case SHARE_STATUS.NOT_SHARED:
      return PERMISSION_LEVEL.NONE
  }
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<Block | null> {
  const permissionLevel: PermissionLevel = await getBlockPermissionLevel(ctx, {
    block,
  })
  if (permissionLevel === PERMISSION_LEVEL.NONE) {
    return null
  }

  return block
}

async function isBlockSharedWithMember(
  ctx: CampaignQueryCtx,
  {
    blockId,
    campaignMemberId,
  }: { blockId: Id<'blocks'>; campaignMemberId: Id<'campaignMembers'> },
): Promise<boolean> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  return share !== null
}
