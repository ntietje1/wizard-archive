import { CAMPAIGN_MEMBER_ROLE } from '../../../shared/campaigns/types'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { SHARE_STATUS } from '../../../shared/block-shares/share-status'
import {
  getBlockAllPlayersPermissionLevel,
  getEffectiveBlockVisibilityPermissionLevel,
} from '../../../shared/permissions/block-visibility'
import { normalizeExplicitSharePermissionLevel } from '../../../shared/permissions/share-permissions'
import type { CampaignQueryCtx } from '../../functions'
import type { Block } from '../../blocks/types'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMemberRow } from '../../../shared/campaigns/types'

async function getBlockPermissionLevel(
  ctx: CampaignQueryCtx,
  {
    block,
    membership,
    notePermissionLevel,
  }: {
    block: Block
    membership: CampaignMemberRow
    notePermissionLevel: PermissionLevel | null | undefined
  },
): Promise<PermissionLevel> {
  const shareStatus = block.shareStatus ?? SHARE_STATUS.NOT_SHARED

  if (membership.role === CAMPAIGN_MEMBER_ROLE.DM) {
    return getEffectiveBlockVisibilityPermissionLevel({
      isDm: true,
      notePermissionLevel,
      allPlayersPermissionLevel: getBlockAllPlayersPermissionLevel(shareStatus),
    })
  }

  const checkId = membership._id

  const memberPermissionLevel = await getBlockMemberPermissionLevel(ctx, {
    blockId: block._id,
    campaignMemberId: checkId,
    campaignId: block.campaignId,
  })

  return getEffectiveBlockVisibilityPermissionLevel({
    isDm: false,
    notePermissionLevel,
    allPlayersPermissionLevel: getBlockAllPlayersPermissionLevel(shareStatus),
    memberPermissionLevel,
  })
}

export async function enforceBlockSharePermissionsOrNull(
  ctx: CampaignQueryCtx,
  {
    block,
    notePermissionLevel,
  }: { block: Block; notePermissionLevel: PermissionLevel | null | undefined },
): Promise<{ block: Block; permissionLevel: PermissionLevel } | null> {
  return await enforceBlockSharePermissionsForMembershipOrNull(ctx, {
    block,
    membership: ctx.membership,
    notePermissionLevel,
  })
}

export async function enforceBlockSharePermissionsForMembershipOrNull(
  ctx: CampaignQueryCtx,
  {
    block,
    membership,
    notePermissionLevel,
  }: {
    block: Block
    membership: CampaignMemberRow
    notePermissionLevel: PermissionLevel | null | undefined
  },
): Promise<{ block: Block; permissionLevel: PermissionLevel } | null> {
  const permissionLevel = await getBlockPermissionLevel(ctx, {
    block,
    membership,
    notePermissionLevel,
  })
  if (permissionLevel === PERMISSION_LEVEL.NONE) {
    return null
  }

  return { block, permissionLevel }
}

async function getBlockMemberPermissionLevel(
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
): Promise<Extract<PermissionLevel, 'none' | 'view'> | null> {
  const share = await ctx.db
    .query('blockShares')
    .withIndex('by_campaign_block_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('blockId', blockId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .first()

  if (!share) return null
  const permissionLevel = normalizeExplicitSharePermissionLevel(share.permissionLevel)
  return permissionLevel === PERMISSION_LEVEL.NONE ? PERMISSION_LEVEL.NONE : PERMISSION_LEVEL.VIEW
}
