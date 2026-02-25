import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { customBlockValidator } from '../blocks/schema'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'
import {
  getFolderContentsForDownload as getFolderContentsForDownloadFn,
  getRootContentsForDownload as getRootContentsForDownloadFn,
} from './functions/getFolderContentsForDownload'

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
    content: v.array(customBlockValidator),
  }),
  v.object({
    type: v.literal(SIDEBAR_ITEM_TYPES.gameMaps),
    name: v.string(),
    path: v.string(),
    downloadUrl: v.union(v.null(), v.string()),
  }),
)

export const getFolderContentsForDownload = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
  },
  returns: v.object({
    folderName: v.string(),
    items: v.array(downloadItemValidator),
  }),
  handler: async (ctx, args) => {
    return await getFolderContentsForDownloadFn(ctx, args.folderId)
  },
})

export const getRootContentsForDownload = campaignQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.object({
    items: v.array(downloadItemValidator),
  }),
  handler: async (ctx) => {
    return await getRootContentsForDownloadFn(ctx)
  },
})
