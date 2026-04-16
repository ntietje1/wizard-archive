import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createFile as createFileFn } from './functions/createFile'
import { updateFile as updateFileFn } from './functions/updateFile'
import type { Id } from '../_generated/dataModel'

export const createFile = campaignMutation({
  args: {
    name: v.string(),
    storageId: v.optional(v.id('_storage')),
    parentId: v.nullable(v.id('sidebarItems')),
    parentPath: v.optional(v.array(v.string())),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    return await createFileFn(ctx, {
      name: args.name,
      storageId: args.storageId,
      parentId: args.parentId,
      parentPath: args.parentPath,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const updateFile = campaignMutation({
  args: {
    fileId: v.id('sidebarItems'),
    name: v.optional(v.string()),
    storageId: v.optional(v.nullable(v.id('_storage'))),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    return await updateFileFn(ctx, {
      fileId: args.fileId,
      name: args.name,
      storageId: args.storageId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
