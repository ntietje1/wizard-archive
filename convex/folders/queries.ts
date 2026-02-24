import { v } from 'convex/values'
import { dmQuery } from '../functions'
import { downloadableItemValidator } from './schema'
import {
  getFolderContentsForDownload as getFolderContentsForDownloadFn,
  getRootContentsForDownload as getRootContentsForDownloadFn,
} from './functions/getFolderContentsForDownload'
import type { DownloadableItem } from './types'

export const getFolderContentsForDownload = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    folderId: v.id('folders'),
  },
  returns: v.object({
    folderName: v.string(),
    items: v.array(downloadableItemValidator),
  }),
  handler: async (
    ctx,
    args,
  ): Promise<{ folderName: string; items: Array<DownloadableItem> }> => {
    return await getFolderContentsForDownloadFn(ctx, args.folderId)
  },
})

export const getRootContentsForDownload = dmQuery({
  args: { campaignId: v.id('campaigns') },
  returns: v.object({
    items: v.array(downloadableItemValidator),
  }),
  handler: async (ctx) => {
    return await getRootContentsForDownloadFn(ctx)
  },
})
