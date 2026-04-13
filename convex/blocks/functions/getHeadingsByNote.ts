import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { BlockNoteId } from '../types'

export interface HeadingResult {
  blockNoteId: BlockNoteId
  text: string
  level: 1 | 2 | 3
  normalizedText: string
}

export async function getHeadingsByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<HeadingResult>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note', (q) => q.eq('campaignId', note.campaignId).eq('noteId', noteId))
    .filter((q) => q.and(q.eq(q.field('deletionTime'), null), q.eq(q.field('type'), 'heading')))
    .collect()

  blocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const headings: Array<HeadingResult> = []
  for (const block of blocks) {
    const text = block.plainText
    if (!text) continue
    const rawLevel =
      block.type === 'heading' ? (block.props as Record<string, unknown>).level : undefined
    const level: 1 | 2 | 3 = rawLevel === 1 || rawLevel === 2 || rawLevel === 3 ? rawLevel : 1
    headings.push({
      blockNoteId: block.blockNoteId,
      text,
      level,
      normalizedText: text.toLowerCase().trim().replace(/\s+/g, ' '),
    })
  }

  return headings
}
