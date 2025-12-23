import { v } from 'convex/values'
import { query } from '../_generated/server'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { anySidebarItemValidator } from '../sidebarItems/schema'
import { getSidebarItemAncestors } from '../sidebarItems/sidebarItems'
import { folderValidator } from './schema'
import {
  getFolderBySlug as getFolderBySlugFn,
  getFolder as getFolderFn,
} from './folders'
import type { AnySidebarItem } from '../sidebarItems/types'
import type { Folder } from './types'

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
  handler: async (ctx, args): Promise<Array<AnySidebarItem>> => {
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
