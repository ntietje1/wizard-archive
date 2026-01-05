import { v } from 'convex/values'
import { query } from '../_generated/server'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { fileValidator } from './schema'
import { getFileBySlug as getFileBySlugFn, getFile as getFileFn } from './files'
import type { File } from './types'

export const getFile = query({
  args: {
    fileId: v.id('files'),
  },
  returns: fileValidator,
  handler: async (ctx, args): Promise<File> => {
    return getFileFn(ctx, args.fileId)
  },
})

export const getFileBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    slug: v.string(),
  },
  returns: v.union(fileValidator, v.null()),
  handler: async (ctx, args): Promise<File | null> => {
    return getFileBySlugFn(ctx, args.campaignId, args.slug)
  },
})
