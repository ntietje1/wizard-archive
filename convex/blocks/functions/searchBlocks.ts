import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { BlockNoteId, BlockType } from '../types'

export interface BlockSearchResult {
  blockNoteId: BlockNoteId
  noteId: Id<'sidebarItems'>
  plainText: string
  type: BlockType
}

export async function searchBlocks(
  ctx: CampaignQueryCtx,
  { query }: { query: string },
): Promise<Array<BlockSearchResult>> {
  if (!query.trim()) return []

  const results = await ctx.db
    .query('blocks')
    .withSearchIndex('search_plainText', (q) =>
      q.search('plainText', query).eq('campaignId', ctx.campaign._id),
    )
    .take(50)

  return results.map((block) => ({
    blockNoteId: block.blockNoteId,
    noteId: block.noteId,
    plainText: block.plainText,
    type: block.type as BlockType,
  }))
}
