import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/editor-blocks/share-status'
import { getBlockVisibilityPermissionLevel } from '../../../shared/permissions/block-visibility'
import type { CampaignQueryCtx } from '../../functions'
import type { Block } from '../../blocks/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { Id } from '../../_generated/dataModel'

async function getBlockPermissionLevel(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<PermissionLevel> {
  const { membership } = ctx
  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return getBlockVisibilityPermissionLevel({
      isDm: true,
      shareStatus,
    })
  }

  const checkId = membership._id

  const isIndividuallySharedWithMember =
    shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED
      ? await isBlockSharedWithMember(ctx, {
          blockId: block._id,
          campaignMemberId: checkId,
          campaignId: block.campaignId,
        })
      : false

  return getBlockVisibilityPermissionLevel({
    isDm: false,
    shareStatus,
    isIndividuallySharedWithMember,
  })
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: CampaignQueryCtx,
  { block }: { block: Block },
): Promise<{ block: Block; permissionLevel: PermissionLevel } | null> {
  const permissionLevel = await getBlockPermissionLevel(ctx, { block })
  if (permissionLevel === PERMISSION_LEVEL.NONE) {
    return null
  }

  return { block, permissionLevel }
}

async function isBlockSharedWithMember(
  ctx: CampaignQueryCtx,
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
    .first()

  return share !== null
}
