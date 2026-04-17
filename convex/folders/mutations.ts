import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createItemParentArgsValidator } from '../sidebarItems/createParentTarget'
import { createFolder as createFolderFn } from './functions/createFolder'
import { updateFolder as updateFolderFn } from './functions/updateFolder'
import type { Id } from '../_generated/dataModel'

export const updateFolder = campaignMutation({
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

export const createFolder = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: v.string(),
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
      parentTarget: args.parentTarget,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
