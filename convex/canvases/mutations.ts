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
    const iconName =
      args.iconName === undefined ? undefined : requireSidebarItemIconName(args.iconName)
    const color = args.color === undefined ? undefined : requireSidebarItemColor(args.color)
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
    const name = args.name ? requireSidebarItemName(args.name) : undefined
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
