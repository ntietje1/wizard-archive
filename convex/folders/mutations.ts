import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import {
  createItemParentArgsValidator,
  requireCreateParentTarget,
} from '../sidebarItems/validation/parent'
import { requireOptionalSidebarItemColor } from '../sidebarItems/validation/color'
import { requireOptionalSidebarItemIconName } from '../sidebarItems/validation/icon'
import {
  sidebarItemColorValidator,
  sidebarItemIconNameValidator,
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
import {
  requireOptionalSidebarItemName,
  requireSidebarItemName,
} from '../sidebarItems/validation/name'
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
    const name = requireOptionalSidebarItemName(args.name)
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
    const iconName = requireOptionalSidebarItemIconName(args.iconName) ?? undefined
    const color = requireOptionalSidebarItemColor(args.color) ?? undefined
    return await createFolderFn(ctx, {
      name,
      parentTarget,
      iconName,
      color,
    })
  },
})
