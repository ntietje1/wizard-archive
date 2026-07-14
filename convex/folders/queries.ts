import { v } from 'convex/values'
import { campaignQuery, dmQuery } from '../functions'
import { editorBlockInputValidator } from '../blocks/schema'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import {
  getRootContentsForDownload as getRootContentsForDownloadFn,
  getSidebarItemsForDownload as getSidebarItemsForDownloadFn,
} from './functions/getItemsForDownload'
import { resourceIdValidator } from '../resources/validators'

const downloadItemValidator = v.union(
  v.object({
    type: v.literal(RESOURCE_TYPES.files),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
  v.object({
    type: v.literal(RESOURCE_TYPES.notes),
    name: v.string(),
    path: v.string(),
    content: v.array(editorBlockInputValidator),
  }),
  v.object({
    type: v.literal(RESOURCE_TYPES.gameMaps),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
  v.object({
    type: v.literal(RESOURCE_TYPES.canvases),
    name: v.string(),
    path: v.string(),
    content: v.object({
      edges: v.array(v.any()),
      nodes: v.array(v.any()),
    }),
  }),
)

export const getRootContentsForDownload = dmQuery({
  args: {},
  returns: v.object({
    items: v.array(downloadItemValidator),
  }),
  handler: async (ctx) => {
    return await getRootContentsForDownloadFn(ctx)
  },
})

export const getSidebarItemsForDownload = campaignQuery({
  args: {
    sourceItemIds: v.array(resourceIdValidator),
  },
  returns: v.object({
    items: v.array(downloadItemValidator),
  }),
  handler: async (ctx, args) => {
    return await getSidebarItemsForDownloadFn(ctx, args.sourceItemIds)
  },
})
