import { v } from 'convex/values'
import { authQuery } from '../functions'
import { blockShareValidator } from './schema'
import { getBlockSharesDm } from './functions/getBlockSharesForBlock'

export const getBlockShares = authQuery({
  args: {
    blockId: v.id('blocks'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args) => {
    return await getBlockSharesDm(ctx, { blockId: args.blockId })
  },
})
