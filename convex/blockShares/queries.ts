import { v } from 'convex/values'
import { dmQuery } from '../functions'
import { blockShareValidator } from './schema'
import { getBlockSharesForBlock } from './functions/getBlockSharesForBlock'

export const getBlockShares = dmQuery({
  args: {
    campaignId: v.id('campaigns'),
    blockId: v.id('blocks'),
  },
  returns: v.array(blockShareValidator),
  handler: async (ctx, args) => {
    return await getBlockSharesForBlock(ctx, { blockId: args.blockId })
  },
})
