import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { enhanceFileWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { File, FileWithContent } from './types'

export const getFile = async (
  ctx: Ctx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)
  if (!rawFile) {
    return null
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: rawFile.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const file = (await enhanceSidebarItem(ctx, rawFile)) as File

  return enhanceFileWithContent(ctx, file)
}

export const getFileBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<FileWithContent | null> => {
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

  if (!file) {
    return null
  }

  return getFile(ctx, file._id)
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
