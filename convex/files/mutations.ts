import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/createParentTarget'
import { requireSidebarItemColor, requireOptionalSidebarItemColor } from '../sidebarItems/color'
import {
  requireOptionalSidebarItemIconName,
  requireSidebarItemIconName,
} from '../sidebarItems/icon'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
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
    iconName: v.optional(sidebarItemIconNameValidator),
    color: v.optional(sidebarItemColorValidator),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    const iconName =
      args.iconName === undefined ? undefined : requireSidebarItemIconName(args.iconName)
    const color = args.color === undefined ? undefined : requireSidebarItemColor(args.color)
    return await createFileFn(ctx, {
      name,
      storageId: args.storageId,
      parentTarget,
      iconName,
      color,
    })
  },
})

export const updateFile = campaignMutation({
  args: {
    fileId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    storageId: v.optional(v.nullable(v.id('_storage'))),
    iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
    color: v.optional(v.nullable(sidebarItemColorValidator)),
  },
  returns: v.object({
    fileId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    const iconName = requireOptionalSidebarItemIconName(args.iconName)
    const color = requireOptionalSidebarItemColor(args.color)
    return await updateFileFn(ctx, {
      fileId: args.fileId,
      name,
      storageId: args.storageId,
      iconName,
      color,
    })
  },
})
