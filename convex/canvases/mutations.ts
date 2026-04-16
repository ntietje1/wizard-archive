import { v } from 'convex/values'
import { campaignMutation } from '../functions'
import { createCanvas as createCanvasFn } from './functions/createCanvas'
import { updateCanvas as updateCanvasFn } from './functions/updateCanvas'

export const createCanvas = campaignMutation({
  args: {
    name: v.string(),
    parentId: v.nullable(v.id('sidebarItems')),
    parentPath: v.optional(v.array(v.string())),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: v.string(),
  }),
  handler: async (ctx, args) => {
    return await createCanvasFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      parentPath: args.parentPath,
      iconName: args.iconName,
      color: args.color,
    })
  },
})

export const updateCanvas = campaignMutation({
  args: {
    canvasId: v.id('sidebarItems'),
    name: v.optional(v.string()),
    iconName: v.optional(v.nullable(v.string())),
    color: v.optional(v.nullable(v.string())),
  },
  returns: v.object({
    canvasId: v.id('sidebarItems'),
    slug: v.string(),
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
