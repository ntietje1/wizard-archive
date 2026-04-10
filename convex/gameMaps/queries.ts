import { v } from 'convex/values'
import { authQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getSidebarItemWithContent } from '../sidebarItems/functions/getSidebarItemWithContent'
import type { GameMapWithContent } from './types'

export const getMap = authQuery({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.union(mapWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<GameMapWithContent | null> => {
    return (await getSidebarItemWithContent(ctx, args.mapId)) as GameMapWithContent | null
  },
})
