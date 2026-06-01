import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import { logger } from '../../common/logger'
import { headingPropsSchema } from '../../../shared/editor-blocks/blockSchemas'
import type { Heading } from '../../../shared/editor-blocks/types'

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
    const props = headingPropsSchema.safeParse(block.props)
    if (!props.success) {
      logger.warn('Skipping heading block with invalid props', {
        blockId: block._id,
        noteId,
        blockNoteId: block.blockNoteId,
      })
      continue
    }
    headings.push({
      blockNoteId: block.blockNoteId,
      text,
      level: props.data.level,
      normalizedText: text.toLowerCase().trim().replace(/\s+/g, ' '),
    })
  }

  return headings
}
