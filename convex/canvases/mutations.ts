import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createItemParentArgsValidator } from '../sidebarItems/createParentTarget'
import {
  sidebarItemNameValidator,
  sidebarItemSlugValidator,
} from '../sidebarItems/schema/validators'
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
    return await createCanvasFn(ctx, {
      name: args.name,
      parentTarget: args.parentTarget,
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
    return await updateCanvasFn(ctx, {
      canvasId: args.canvasId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
