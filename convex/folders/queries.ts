import { query } from '../_generated/server'
import { v } from 'convex/values'
import { Folder } from './types'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  getFolder as getFolderFn,
  getFolderBySlug as getFolderBySlugFn,
} from './folders'
import { folderValidator } from './schema'
import { anySidebarItemValidator } from '../sidebarItems/schema'
import { getSidebarItemAncestors } from '../sidebarItems/sidebarItems'
import { AnySidebarItem } from '../sidebarItems/types'

export const getFolder = query({
  args: {
    folderId: v.id('folders'),
  },
  returns: folderValidator,
  handler: async (ctx, args): Promise<Folder> => {
    const folder = await getFolderFn(ctx, args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }
    return folder
  },
})

export const getFolderAncestors = query({
  args: {
    folderId: v.id('folders'),
  },
  returns: v.array(anySidebarItemValidator),
  handler: async (ctx, args): Promise<AnySidebarItem[]> => {
    const folder = await ctx.db.get(args.folderId)
    if (!folder) {
      throw new Error('Folder not found')
    }

    await requireCampaignMembership(
      ctx,
      { campaignId: folder.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )

    return await getSidebarItemAncestors(
      ctx,
      folder.campaignId,
      folder.parentId,
    )
  },
})

export const getFolderBySlug = query({
  args: {
    campaignId: v.id('campaigns'),
    slug: v.string(),
  },
  returns: folderValidator,
  handler: async (ctx, args): Promise<Folder> => {
    const folder = await getFolderBySlugFn(ctx, args.campaignId, args.slug)
    if (!folder) {
      throw new Error('Folder not found')
    }
    return folder
  },
})
