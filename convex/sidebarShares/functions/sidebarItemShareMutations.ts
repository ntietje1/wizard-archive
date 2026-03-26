import { ERROR_CODE, throwClientError } from '../../errors'
import { getCurrentSession } from '../../sessions/functions/getCurrentSession'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'
import type {
  SidebarItemId,
  SidebarItemType,
} from '../../sidebarItems/types/baseTypes'
import type { PermissionLevel } from '../../permissions/types'

export async function shareSidebarItemWithMember(
  ctx: AuthMutationCtx,
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
  const item = await ctx.db.get(sidebarItemId)
  if (!item)
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  const campaignId = item.campaignId

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
  const currentSession = await getCurrentSession(ctx, { campaignId })

  return await ctx.db.insert('sidebarItemShares', {
    campaignId,
    sidebarItemId,
    sidebarItemType,
    campaignMemberId,
    sessionId: currentSession?._id ?? null,
    permissionLevel: permissionLevel ?? null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: ctx.user.profile._id,
  })
}

export async function unshareSidebarItemFromMember(
  ctx: AuthMutationCtx,
  {
    sidebarItemId,
    campaignMemberId,
  }: {
    sidebarItemId: SidebarItemId
    campaignMemberId: Id<'campaignMembers'>
  },
): Promise<void> {
  const item = await ctx.db.get(sidebarItemId)
  if (!item) return
  const campaignId = item.campaignId

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
  ctx: AuthMutationCtx,
  { sidebarItemId }: { sidebarItemId: SidebarItemId },
): Promise<void> {
  const item = await ctx.db.get(sidebarItemId)
  if (!item) return
  const campaignId = item.campaignId

  const shares = await ctx.db
    .query('sidebarItemShares')
    .withIndex('by_campaign_item_member', (q) =>
      q.eq('campaignId', campaignId).eq('sidebarItemId', sidebarItemId),
    )
    .collect()

  await Promise.all(shares.map((share) => ctx.db.delete(share._id)))
}
