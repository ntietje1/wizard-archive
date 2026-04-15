import { ERROR_CODE, throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import type { Heading, HeadingLevel } from '../types'

const VALID_HEADING_LEVELS = new Set<number>([1, 2, 3, 4, 5, 6])

export async function getHeadingsByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<Heading>> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_type', (q) =>
      q.eq('campaignId', note.campaignId).eq('noteId', noteId).eq('type', 'heading'),
    )
    .collect()

  blocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const headings: Array<Heading> = []
  for (const block of blocks) {
    const text = block.plainText
    if (!text) continue
    const rawLevel = block.props.level
    const level: HeadingLevel =
      typeof rawLevel === 'number' && VALID_HEADING_LEVELS.has(rawLevel)
        ? (rawLevel as HeadingLevel)
        : 1
    headings.push({
      blockNoteId: block.blockNoteId,
      text,
      level,
      normalizedText: text.toLowerCase().trim().replace(/\s+/g, ' '),
    })
  }

  return headings
}
