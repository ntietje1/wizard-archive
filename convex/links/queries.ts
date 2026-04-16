import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { getBacklinksForItem as getBacklinksForItemFn } from './functions/getBacklinksForItem'
import { getOutgoingLinksForNote as getOutgoingLinksForNoteFn } from './functions/getOutgoingLinksForNote'
import { noteLinkValidator } from './schema'

export const getBacklinksForItem = campaignQuery({
  args: {
    itemId: v.id('sidebarItems'),
  },
  returns: v.array(noteLinkValidator),
  handler: async (ctx, { itemId }) => {
    return await getBacklinksForItemFn(ctx, { itemId })
  },
})

export const getOutgoingLinksForNote = campaignQuery({
  args: {
    noteId: v.id('sidebarItems'),
  },
  returns: v.array(noteLinkValidator),
  handler: async (ctx, { noteId }) => {
    return await getOutgoingLinksForNoteFn(ctx, { noteId })
  },
})
