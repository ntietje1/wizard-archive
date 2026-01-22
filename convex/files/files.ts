import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { getBookmark } from '../bookmarks/bookmarks'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { File } from './types'
import type { MutationCtx } from '../_generated/server'

export const getFile = async (ctx: Ctx, fileId: Id<'files'>): Promise<File> => {
  const file = await ctx.db.get(fileId)
  if (!file) {
    throw new Error('File not found')
  }

  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: file.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const bookmark = await getBookmark(
    ctx,
    file.campaignId,
    campaignWithMembership.member._id,
    file._id,
  )
  return {
    ...file,
    isBookmarked: !!bookmark,
  }
}

export const getFileBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<File | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const file = await ctx.db
    .query('files')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  return file
}

export const deleteFile = async (
  ctx: MutationCtx,
  fileId: Id<'files'>,
): Promise<Id<'files'>> => {
  const file = await ctx.db.get(fileId)
  if (!file) {
    throw new Error('File not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: file.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  await ctx.db.delete(fileId)
  return fileId
}
