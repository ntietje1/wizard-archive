import { v } from 'convex/values'
import { authMutation } from '../functions'
import { createCanvas as createCanvasFn } from './functions/createCanvas'
import { updateCanvas as updateCanvasFn } from './functions/updateCanvas'
import type { Id } from '../_generated/dataModel'

export const createCanvas = authMutation({
  args: {
    campaignId: v.id('campaigns'),
    name: v.string(),
    parentId: v.union(v.id('folders'), v.null()),
    iconName: v.optional(v.string()),
    color: v.optional(v.string()),
  },
  returns: v.object({
    canvasId: v.id('canvases'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ canvasId: Id<'canvases'>; slug: string }> => {
    return await createCanvasFn(ctx, {
      name: args.name,
      parentId: args.parentId,
      iconName: args.iconName,
      color: args.color,
      campaignId: args.campaignId,
    })
  },
})

export const updateCanvas = authMutation({
  args: {
    canvasId: v.id('canvases'),
    name: v.optional(v.string()),
    iconName: v.optional(v.union(v.string(), v.null())),
    color: v.optional(v.union(v.string(), v.null())),
  },
  returns: v.object({
    canvasId: v.id('canvases'),
    slug: v.string(),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ canvasId: Id<'canvases'>; slug: string }> => {
    return await updateCanvasFn(ctx, {
      canvasId: args.canvasId,
      name: args.name,
      iconName: args.iconName,
      color: args.color,
    })
  },
})
