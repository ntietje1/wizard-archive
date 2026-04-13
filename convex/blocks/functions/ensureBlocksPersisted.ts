import { reconstructYDoc } from '../../yjsSync/functions/reconstructYDoc'
import { yDocToBlocks } from '../../notes/blocknote'
import { saveAllBlocksForNote } from './saveAllBlocksForNote'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function ensureBlocksPersisted(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<void> {
  const { doc } = await reconstructYDoc(ctx, noteId)
  try {
    const blocks = yDocToBlocks(doc, 'document')
    await saveAllBlocksForNote(ctx, { noteId, content: blocks })
  } finally {
    doc.destroy()
  }
}
