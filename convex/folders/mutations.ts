import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/validation/parent'
import {
  requireSidebarItemColor,
  requireOptionalSidebarItemColor,
} from '../sidebarItems/validation/color'
import {
  requireOptionalSidebarItemIconName,
  requireSidebarItemIconName,
} from '../sidebarItems/validation/icon'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
import { requireSidebarItemName } from '../sidebarItems/validation/name'
import { createFolder as createFolderFn } from './functions/createFolder'
import { updateFolder as updateFolderFn } from './functions/updateFolder'
import type { Id } from '../_generated/dataModel'

export const updateFolder = campaignMutation({
  args: {
    folderId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
    color: v.optional(v.nullable(sidebarItemColorValidator)),
  },
  returns: v.object({
    folderId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    const iconName = requireOptionalSidebarItemIconName(args.iconName)
    const color = requireOptionalSidebarItemColor(args.color)
    return await updateFolderFn(ctx, {
      folderId: args.folderId,
      name,
      iconName,
      color,
    })
  },
})

export const createFolder = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    iconName: v.optional(sidebarItemIconNameValidator),
    color: v.optional(sidebarItemColorValidator),
  },
  returns: v.object({
    folderId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    const iconName =
      args.iconName === undefined ? undefined : requireSidebarItemIconName(args.iconName)
    const color = args.color === undefined ? undefined : requireSidebarItemColor(args.color)
    return await createFolderFn(ctx, {
      name,
      parentTarget,
      iconName,
      color,
    })
  },
})
