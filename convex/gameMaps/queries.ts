import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'

export const getMap = campaignQuery({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.nullable(mapWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.mapId, RESOURCE_TYPES.gameMaps)
  },
})
