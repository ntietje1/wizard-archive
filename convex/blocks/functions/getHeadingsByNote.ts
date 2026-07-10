import { ERROR_CODE } from '../../../shared/errors/client'
import { throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../../shared/permissions/types'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { checkItemAccess } from '../../sidebarItems/validation/access'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'
import { logger } from '../../common/logger'
import { headingPropsSchema } from '@wizard-archive/editor/notes/document-contract'
import type { Heading } from '@wizard-archive/editor/notes/document-contract'

export async function getHeadingsByNote(
  ctx: CampaignQueryCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<Array<Heading>> {
  const note = await getSidebarItem(ctx, noteId)
  if (!note) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  if (note.type !== 'note') throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const visibleNote = await checkItemAccess(ctx, {
    rawItem: note,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!visibleNote) return []

  const blocks = await ctx.db
    .query('blocks')
    .withIndex('by_campaign_note_type', (q) =>
      q.eq('campaignId', visibleNote.campaignId).eq('noteId', noteId).eq('type', 'heading'),
    )
    .collect()

  blocks.sort((a, b) => (a.position ?? 0) - (b.position ?? 0))

  const headings: Array<Heading> = []
  for (const block of blocks) {
    const visibleBlock = await enforceBlockSharePermissionsOrNull(ctx, {
      block,
      notePermissionLevel: visibleNote.myPermissionLevel,
    })
    if (!visibleBlock) continue
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
      noteBlockId: block.blockNoteId,
      text,
      level: props.data.level,
      normalizedText: text.toLowerCase().trim().replace(/\s+/g, ' '),
    })
  }

  return headings
}
