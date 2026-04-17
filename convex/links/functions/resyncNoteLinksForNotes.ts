import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { syncNoteLinks } from './syncNoteLinks'
import type { CampaignMutationCtx } from '../../functions'
import type { Block } from '../../blocks/types'
import type { Id } from '../../_generated/dataModel'

export async function resyncNoteLinksForNotes(
  ctx: CampaignMutationCtx,
  { noteIds }: { noteIds: Array<Id<'sidebarItems'>> },
): Promise<void> {
  const uniqueNoteIds = [...new Set(noteIds)]

  await Promise.all(
    uniqueNoteIds.map(async (noteId) => {
      const note = await ctx.db.get('sidebarItems', noteId)
      if (
        !note ||
        note.campaignId !== ctx.campaign._id ||
        note.type !== SIDEBAR_ITEM_TYPES.notes ||
        note.deletionTime !== null
      ) {
        return
      }

    const blocks: Array<Block> = await ctx.db
      .query('blocks')
      .withIndex('by_campaign_note_block', (q) =>
        q.eq('campaignId', note.campaignId).eq('noteId', noteId),
      )
      .collect()

    await syncNoteLinks(ctx, {
      noteId,
        campaignId: note.campaignId,
        blocks,
      })
    }),
  )
}
