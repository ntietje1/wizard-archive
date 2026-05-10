import { ERROR_CODE, throwClientError } from '../../errors'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { logEditHistory } from '../../editHistory/log'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { requireItemAccess } from '../../sidebarItems/validation/access'
import { getUserProfileById } from '../../users/functions/getUserProfile'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'
import type { AnySidebarItem } from '../../sidebarItems/types/types'

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
) {
  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')
  }
  const profile = await getUserProfileById(ctx, { profileId: member.userId })
  return profile?.name ?? null
}

async function getShareTargetItem(
  ctx: CampaignMutationCtx,
  sidebarItemId: Id<'sidebarItems'>,
): Promise<AnySidebarItem> {
  const rawItem = await getSidebarItem(ctx, sidebarItemId)
  const item = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })
  if (item.campaignId !== ctx.campaign._id) {
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Item does not belong to this campaign')
  }
  return item
}

async function getExistingMemberShare(
  ctx: CampaignMutationCtx,
  {
    item,
    campaignMemberId,
  }: {
    item: AnySidebarItem
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<ExistingShare> {
  return await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', item.campaignId)
        .eq('sidebarItemId', item._id)
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
    item: AnySidebarItem
    memberName: string | null
    level: PermissionLevel | null
    previousLevel: PermissionLevel | null
  },
) {
  await logEditHistory(ctx, {
    itemId: item._id,
    itemType: item.type,
    action: EDIT_HISTORY_ACTION.permission_changed,
    metadata: {
      memberName,
      level,
      previousLevel,
    },
  })
}

export async function setSidebarItemsMemberPermission(
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
): Promise<Array<Id<'sidebarItemShares'>>> {
  assertShareBatchSize(sidebarItemIds)
  const memberName = await getTargetMemberName(ctx, campaignMemberId)
  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null
  const shareIds: Array<Id<'sidebarItemShares'>> = []

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
      shareIds.push(existingShare._id)
      continue
    }

    const shareId = await ctx.db.insert('sidebarItemShares', {
      campaignId: item.campaignId,
      sidebarItemId: item._id,
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
    shareIds.push(shareId)
  }

  return shareIds
}

export async function clearSidebarItemsMemberPermission(
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
  const memberName = await getTargetMemberName(ctx, campaignMemberId)

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
