import { v } from 'convex/values'
import { campaignQuery } from '../functions'
import { mapWithContentValidator } from './schema'
import { getMap as getMapFn } from './functions/getMap'
import type { GameMapWithContent } from './types'

export const getMap = campaignQuery({
  args: {
    campaignId: v.id('campaigns'),
    mapId: v.id('gameMaps'),
  },
  returns: v.union(mapWithContentValidator, v.null()),
  handler: async (ctx, args): Promise<GameMapWithContent | null> => {
    return getMapFn(ctx, { mapId: args.mapId })
  },
})
