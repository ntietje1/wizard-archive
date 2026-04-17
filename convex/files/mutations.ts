import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/createParentTarget'
import {
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
import { requireSidebarItemName } from '../sidebarItems/sharedValidation'
import { createFile as createFileFn } from './functions/createFile'
import { updateFile as updateFileFn } from './functions/updateFile'
import type { Id } from '../_generated/dataModel'

export const createFile = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    storageId: v.optional(v.id('_storage')),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    return await createFileFn(ctx, {
      name,
      storageId: args.storageId,
      parentTarget,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const updateFile = campaignMutation({
  args: {
    fileId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    storageId: v.optional(v.nullable(v.id('_storage'))),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    return await updateFileFn(ctx, {
      fileId: args.fileId,
      name,
      storageId: args.storageId,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
