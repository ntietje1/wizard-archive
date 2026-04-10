import { v } from 'convex/values'
import { authMutation } from '../functions'
import { createFolder as createFolderFn } from './functions/createFolder'
import { updateFolder as updateFolderFn } from './functions/updateFolder'
import type { Id } from '../_generated/dataModel'

export const updateFolder = authMutation({
  args: {
    folderId: v.id('sidebarItems'),
    name: v.optional(v.string()),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    folderId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> => {
    return await updateFolderFn(ctx, {
      folderId: args.folderId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const createFolder = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.nullable(v.id('sidebarItems')),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    folderId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> => {
    return await createFolderFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      campaignId: args.campaignId,
    })
  },
})
