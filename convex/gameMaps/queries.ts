import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import { RESOURCE_TYPES } from '@wizard-archive/editor/resources/items-persistence-contract'
import { resourceIdValidator } from '../resources/validators'

export const getMap = campaignQuery({
  args: {
    mapId: resourceIdValidator,
  },
  returns: v.nullable(mapWithContentValidator),
  handler: async (ctx, args) => {
    return await getSidebarItemWithContent(ctx, args.mapId, RESOURCE_TYPES.gameMaps)
  },
})
