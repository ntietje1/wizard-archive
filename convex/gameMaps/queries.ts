import { v } from 'convex/values'
import { query } from '../_generated/server'
import { mapWithContentValidator } from './schema'
import { getMap as getMapFn } from './gameMaps'
import type { GameMapWithContent } from './types'

export const getMap = query({
  args: {
    mapId: v.id('gameMaps'),
  },
  returns: v.union(mapWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<GameMapWithContent | null> => {
    return getMapFn(ctx, args.mapId)
  },
})
