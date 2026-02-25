import { getCurrentSession } from '../../sessions/functions/getCurrentSession'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../../permissions/types'

export async function shareSidebarItemWithMember(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    permissionLevel,
  }: {
    sidebarItemId: SidebarItemId
    sidebarItemType: SidebarItemType
    campaignMemberId: Id<'campaignMembers'>
    permissionLevel: PermissionLevel | null
  },
): Promise<Id<'sidebarItemShares'>> {
  const campaignId = ctx.campaign._id

  // Check if share already exists
  const existingShare = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q
        .eq('campaignId', campaignId)
        .eq('sidebarItemId', sidebarItemId)
        .eq('campaignMemberId', campaignMemberId),
    )
    .unique()

  const now = Date.now()

  if (existingShare) {
    // Update permission level if provided and different
    if (
      permissionLevel !== null &&
      existingShare.permissionLevel !== permissionLevel
    ) {
      await ctx.db.patch(existingShare._id, {
        permissionLevel,
        updatedTime: now,
        updatedBy: ctx.user.profile._id,
      })
    }
    return existingShare._id
  }

  // Get current session if any
  const currentSession = await getCurrentSession(ctx)

  return await ctx.db.insert('sidebarItemShares', {
    campaignId,
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    sessionId: currentSession?._id,
    permissionLevel: permissionLevel ?? undefined,
    updatedTime: now,
    updatedBy: ctx.user.profile._id,
    createdBy: ctx.user.profile._id,
  })
}

export async function unshareSidebarItemFromMember(
  ctx: CampaignMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: SidebarItemId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const campaignId = ctx.campaign._id

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
    await ctx.db.delete(share._id)
  }
}

export async function deleteSidebarItemShares(
  ctx: CampaignMutationCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<void> {
  const campaignId = ctx.campaign._id

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  await Promise.all(shares.map((share) => ctx.db.delete(share._id)))
}
