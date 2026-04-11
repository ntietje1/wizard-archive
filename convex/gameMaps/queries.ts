import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { GameMapWithContent } from './types'

export const getMap = campaignQuery({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.nullable(mapWithContentValidator),
  handler: async (ctx, args): Promise<GameMapWithContent | null> => {
    return (await getSidebarItemWithContent(ctx, args.mapId)) as GameMapWithContent | null
  },
})
