import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { editorBlockInputValidator } from '../blocks/schema'
import { SIDEBAR_ITEM_TYPES } from '../../shared/sidebar-items/types'
import {
  getRootContentsForDownload as getRootContentsForDownloadFn,
  getSidebarItemsForDownload as getSidebarItemsForDownloadFn,
} from './functions/getItemsForDownload'

const downloadItemValidator = v.union(
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.files),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.notes),
    name: v.string(),
    path: v.string(),
    content: v.array(editorBlockInputValidator),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
)

export const getRootContentsForDownload = campaignQuery({
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
    sourceItemIds: v.array(v.id('sidebarItems')),
  },
  returns: v.object({
    items: v.array(downloadItemValidator),
  }),
  handler: async (ctx, args) => {
    return await getSidebarItemsForDownloadFn(ctx, args.sourceItemIds)
  },
})
