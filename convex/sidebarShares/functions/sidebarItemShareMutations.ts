import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { EDIT_HISTORY_ACTION } from '@wizard-archive/editor/resources/history-contract'
import { logEditHistory } from '../../editHistory/log'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import {
  requireAcceptedPlayerMember,
  requireCampaignMember,
} from '../../campaigns/functions/acceptedPlayerMember'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../../shared/permissions/types'
import type { AnyResource } from '@wizard-archive/editor/resources/resource-contract'
import { DOMAIN_ID_KIND, generateDomainId } from '@wizard-archive/editor/resources/domain-id'

type ExistingShare = Doc<'sidebarItemShares'> | null
const MAX_SHARE_ITEMS_PER_REQUEST = 100

function assertShareBatchSize(sidebarItemIds: Array<Id<'sidebarItems'>>) {
  if (sidebarItemIds.length > MAX_SHARE_ITEMS_PER_REQUEST) {
    throwClientError(
      ERROR_CODE.VALIDATION_FAILED,
      `Cannot update more than ${MAX_SHARE_ITEMS_PER_REQUEST} items at once`,
    )
  }
}

async function getTargetMemberName(
  ctx: CampaignMutationCtx,
  campaignMemberId: Id<'campaignMembers'>,
  eligibility: 'accepted_player' | 'existing_member',
) {
  const member =
    eligibility === 'accepted_player'
      ? await requireAcceptedPlayerMember(ctx, {
          campaignId: ctx.campaign._id,
          campaignMemberId,
        })
      : await requireCampaignMember(ctx, {
          campaignId: ctx.campaign._id,
          campaignMemberId,
        })
  const profile = await getUserProfileById(ctx, { profileId: member.userId })
  return profile?.name ?? null
}

async function getShareTargetItem(
  ctx: CampaignMutationCtx,
  sidebarItemId: Id<'sidebarItems'>,
): Promise<AnyResource> {
  const rawItem = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  return item
}

async function getExistingMemberShare(
  ctx: CampaignMutationCtx,
  {
    item,
    campaignMemberId,
  }: {
    item: AnyResource
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<ExistingShare> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('sidebarItemId', item.id)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
}

async function logPermissionChange(
  ctx: CampaignMutationCtx,
  {
    item,
    memberName,
    level,
    previousLevel,
  }: {
    item: AnyResource
    memberName: string | null
    level: PermissionLevel | null
    previousLevel: PermissionLevel | null
  },
) {
  await logEditHistory(ctx, {
    itemId: item.id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName,
      level,
      previousLevel,
    },
  })
}

export async function setResourcesMemberPermission(
  ctx: CampaignMutationCtx,
  {
    sidebarItemIds,
    campaignMemberId,
    permissionLevel,
  }: {
    sidebarItemIds: Array<Id<'sidebarItems'>>
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: PermissionLevel
  },
): Promise<void> {
  assertShareBatchSize(sidebarItemIds)
  const memberName = await getTargetMemberName(ctx, campaignMemberId, 'accepted_player')
  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null
  for (const sidebarItemId of sidebarItemIds) {
    const item = await getShareTargetItem(ctx, sidebarItemId)
    const existingShare = await getExistingMemberShare(ctx, { item, campaignMemberId })
    const previousLevel = existingShare?.permissionLevel ?? null

    if (existingShare) {
      if (existingShare.permissionLevel !== permissionLevel) {
        await ctx.db.patch('sidebarItemShares', existingShare._id, {
          permissionLevel,
        })
        await logPermissionChange(ctx, {
          item,
          memberName,
          level: permissionLevel,
          previousLevel,
        })
      }
      continue
    }

    await ctx.db.insert('sidebarItemShares', {
      resourceShareUuid: generateDomainId(DOMAIN_ID_KIND.resourceShare),
      campaignId: ctx.campaign._id,
      sidebarItemId: item.id,
      sidebarItemType: item.type,
      campaignMemberId,
      sessionId: currentSession?._id ?? null,
      permissionLevel,
    })
    await logPermissionChange(ctx, {
      item,
      memberName,
      level: permissionLevel,
      previousLevel: null,
    })
  }
}

export async function clearResourcesMemberPermission(
  ctx: CampaignMutationCtx,
  {
    sidebarItemIds,
    campaignMemberId,
  }: {
    sidebarItemIds: Array<Id<'sidebarItems'>>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  assertShareBatchSize(sidebarItemIds)
  const memberName = await getTargetMemberName(ctx, campaignMemberId, 'existing_member')

  for (const sidebarItemId of sidebarItemIds) {
    const item = await getShareTargetItem(ctx, sidebarItemId)
    const share = await getExistingMemberShare(ctx, { item, campaignMemberId })
    if (!share) continue
    await ctx.db.delete('sidebarItemShares', share._id)
    await logPermissionChange(ctx, {
      item,
      memberName,
      level: null,
      previousLevel: share.permissionLevel,
    })
  }
}
