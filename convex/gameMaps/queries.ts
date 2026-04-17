import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types/baseTypes'

export const getMap = campaignQuery({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.nullable(mapWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.mapId, SIDEBAR_ITEM_TYPES.gameMaps)
  },
})
