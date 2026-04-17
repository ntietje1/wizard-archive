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
import { createCanvas as createCanvasFn } from './functions/createCanvas'
import { updateCanvas as updateCanvasFn } from './functions/updateCanvas'

export const createCanvas = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    iconName: v.optional(sidebarItemIconNameValidator),
    color: v.optional(sidebarItemColorValidator),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args) => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    const iconName = requireOptionalSidebarItemIconName(args.iconName) ?? undefined
    const color = requireOptionalSidebarItemColor(args.color) ?? undefined
    return await createCanvasFn(ctx, {
      name,
      parentTarget,
      iconName,
      color,
    })
  },
})

export const updateCanvas = campaignMutation({
  args: {
    canvasId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    iconName: v.optional(v.nullable(sidebarItemIconNameValidator)),
    color: v.optional(v.nullable(sidebarItemColorValidator)),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args) => {
    const name = requireOptionalSidebarItemName(args.name)
    const iconName = requireOptionalSidebarItemIconName(args.iconName)
    const color = requireOptionalSidebarItemColor(args.color)
    return await updateCanvasFn(ctx, {
      canvasId: args.canvasId,
      name,
      iconName,
      color,
    })
  },
})
