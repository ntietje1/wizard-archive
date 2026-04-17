import { reconstructYDoc } from '../../yjsSync/functions/reconstructYDoc'
import { yDocToBlocks } from '../../notes/blocknote'
import { saveAllBlocksForNote } from './saveAllBlocksForNote'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function ensureBlocksPersisted(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<void> {
  const { doc } = await reconstructYDoc(ctx, noteId)
  try {
    const blocks = yDocToBlocks(doc, 'document')
    const persistedBlocks = await saveAllBlocksForNote(ctx, { noteId, content: blocks })

    const note = await ctx.db.get('sidebarItems', noteId)
    if (note && note.deletionTime === null) {
      await syncNoteLinks(ctx, {
        noteId,
        campaignId: note.campaignId,
        blocks: persistedBlocks,
      })
    }
  } finally {
    doc.destroy()
  }
}
