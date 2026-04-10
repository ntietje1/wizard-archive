import { v } from 'convex/values'
import { authQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getMap as getMapFn } from './functions/getMap'
import type { GameMapWithContent } from './types'

export const getMap = authQuery({
  args: {
    mapId: v.id('sidebarItems'),
  },
  returns: v.union(mapWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<GameMapWithContent | null> => {
    return getMapFn(ctx, { mapId: args.mapId })
  },
})
