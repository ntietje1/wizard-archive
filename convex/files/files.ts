import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { pipe } from '../common/pipeline'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import { enforceSidebarItemSharePermissionsOrNull } from '../shares/itemShares'
import { enhanceFileWithContent } from './helpers'
import type { Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'
import type { MutationCtx } from '../_generated/server'
import type { FileWithContent } from './types'

export const getFile = async (
  ctx: Ctx,
  fileId: Id<'files'>,
): Promise<FileWithContent | null> => {
  const rawFile = await ctx.db.get(fileId)

  return pipe(ctx, rawFile)
    .pipe(enhanceSidebarItem)
    .enforce(enforceSidebarItemSharePermissionsOrNull)
    .pipe(enhanceFileWithContent)
    .run()
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
