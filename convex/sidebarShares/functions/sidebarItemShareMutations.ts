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
): Promise<{ item: AnyResource; itemId: Id<'sidebarItems'> }> {
  const rawItem = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  return { item, itemId: sidebarItemId }
}

async function getExistingMemberShare(
  ctx: CampaignMutationCtx,
  {
    itemId,
    campaignMemberId,
  }: {
    itemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<ExistingShare> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', ctx.campaign._id)
        .eq('sidebarItemId', itemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()
}

async function logPermissionChange(
  ctx: CampaignMutationCtx,
  {
    item,
    itemId,
    memberName,
    level,
    previousLevel,
  }: {
    item: AnyResource
    itemId: Id<'sidebarItems'>
    memberName: string | null
    level: PermissionLevel | null
    previousLevel: PermissionLevel | null
  },
) {
  await logEditHistory(ctx, {
    itemId,
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
  const currentSessionId = ctx.campaign.currentSessionId
  const [memberName, currentSession] = await Promise.all([
    getTargetMemberName(ctx, campaignMemberId, 'accepted_player'),
    currentSessionId ? ctx.db.get('sessions', currentSessionId) : null,
  ])
  await Promise.all(
    [...new Set(sidebarItemIds)].map(async (sidebarItemId) => {
      const { item, itemId } = await getShareTargetItem(ctx, sidebarItemId)
      const existingShare = await getExistingMemberShare(ctx, { itemId, campaignMemberId })
      const previousLevel = existingShare?.permissionLevel ?? null

      if (existingShare) {
        if (existingShare.permissionLevel !== permissionLevel) {
          await ctx.db.patch('sidebarItemShares', existingShare._id, {
            permissionLevel,
          })
          await logPermissionChange(ctx, {
            item,
            itemId,
            memberName,
            level: permissionLevel,
            previousLevel,
          })
        }
        return
      }

      await ctx.db.insert('sidebarItemShares', {
        resourceShareUuid: generateDomainId(DOMAIN_ID_KIND.resourceShare),
        campaignId: ctx.campaign._id,
        sidebarItemId: itemId,
        sidebarItemType: item.type,
        campaignMemberId,
        sessionId: currentSession?._id ?? null,
        permissionLevel,
      })
      await logPermissionChange(ctx, {
        item,
        itemId,
        memberName,
        level: permissionLevel,
        previousLevel: null,
      })
    }),
  )
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

  await Promise.all(
    [...new Set(sidebarItemIds)].map(async (sidebarItemId) => {
      const { item, itemId } = await getShareTargetItem(ctx, sidebarItemId)
      const share = await getExistingMemberShare(ctx, { itemId, campaignMemberId })
      if (!share) return
      await ctx.db.delete('sidebarItemShares', share._id)
      await logPermissionChange(ctx, {
        item,
        itemId,
        memberName,
        level: null,
        previousLevel: share.permissionLevel,
      })
    }),
  )
}
