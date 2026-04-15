import { ERROR_CODE, throwClientError } from '../../errors'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type { PermissionLevel } from '../../permissions/types'

export async function shareSidebarItemWithMember(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
    permissionLevel,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: PermissionLevel | null
  },
): Promise<Id<'sidebarItemShares'>> {
  const item = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  const campaignId = item.campaignId
  const sidebarItemType = item.type

  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')

  const existingShare = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (existingShare) {
    if (permissionLevel !== null && existingShare.permissionLevel !== permissionLevel) {
      await ctx.db.patch('sidebarItemShares', existingShare._id, {
        permissionLevel,
      })
    }
    return existingShare._id
  }

  const currentSessionId = ctx.campaign.currentSessionId
  const currentSession = currentSessionId ? await ctx.db.get('sessions', currentSessionId) : null

  return await ctx.db.insert('sidebarItemShares', {
    campaignId,
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    permissionLevel: permissionLevel ?? null,
  })
}

export async function unshareSidebarItemFromMember(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: Id<'sidebarItems'>
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const item = await ctx.db.get('sidebarItems', sidebarItemId)
  if (!item) throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  const campaignId = item.campaignId

  const member = await ctx.db.get('campaignMembers', campaignMemberId)
  if (!member || member.campaignId !== campaignId)
    throwClientError(ERROR_CODE.VALIDATION_FAILED, 'Member does not belong to this campaign')

  const share = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  if (share) {
    await ctx.db.delete('sidebarItemShares', share._id)
  }
}
