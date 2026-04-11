import { v } from 'convex/values'
import { dmQuery } from '../functions'
import { blockShareValidator } from './schema'
import { getBlockSharesDm } from './functions/getBlockSharesForBlock'

export const getBlockShares = dmQuery({
  args: {
    blockId: v.id('blocks'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args) => {
    return await getBlockSharesDm(ctx, { blockId: args.blockId })
  },
})
