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
import { createCanvas as createCanvasFn } from './functions/createCanvas'
import { updateCanvas as updateCanvasFn } from './functions/updateCanvas'

export const createCanvas = campaignMutation({
  args: {
    ...createItemParentArgsValidator,
    name: sidebarItemNameValidator,
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args) => {
    const name = requireSidebarItemName(args.name)
    const parentTarget = requireCreateParentTarget(args.parentTarget)
    return await createCanvasFn(ctx, {
      name,
      parentTarget,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const updateCanvas = campaignMutation({
  args: {
    canvasId: v.id('sidebarItems'),
    name: v.optional(sidebarItemNameValidator),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: sidebarItemSlugValidator,
  }),
  handler: async (ctx, args) => {
    const name = args.name ? requireSidebarItemName(args.name) : undefined
    return await updateCanvasFn(ctx, {
      canvasId: args.canvasId,
      name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
