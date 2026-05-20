import { reconstructYDoc } from '../../yjsSync/functions/reconstructYDoc'
import { yDocToBlocks } from '../blocknote'
import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import { saveAllNoteValuesForNote } from '../../noteValues/functions/saveAllNoteValuesForNote'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import type { Id } from '../../_generated/dataModel'
import type { CampaignMutationCtx } from '../../functions'
import type { CustomBlock } from '../editorSpecs'
import type { Block } from '../../blocks/types'

export async function syncNoteDerivedDataFromPersistedBlocks(
  ctx: CampaignMutationCtx,
  {
    noteId,
    blocks,
  }: {
    noteId: Id<'sidebarItems'>
    blocks: Array<Block>
  },
): Promise<void> {
  const note = await ctx.db.get('sidebarItems', noteId)
  if (!note || !isActiveSidebarItem(note)) {
    return
  }
  const content = reconstructBlockTree(blocks)

  await Promise.all([
    syncNoteLinks(ctx, {
      noteId,
      campaignId: note.campaignId,
      blocks,
    }),
    saveAllNoteValuesForNote(ctx, {
      noteId,
      content,
    }),
  ])
}

export async function syncNoteIndexesFromBlocks(
  ctx: CampaignMutationCtx,
  {
    noteId,
    content,
  }: {
    noteId: Id<'sidebarItems'>
    content: Array<CustomBlock>
  },
): Promise<void> {
  const persistedBlocks = await saveAllBlocksForNote(ctx, { noteId, content })
  await syncNoteDerivedDataFromPersistedBlocks(ctx, {
    noteId,
    blocks: persistedBlocks,
  })
}

export async function syncNoteDerivedDataFromYDoc(
  ctx: CampaignMutationCtx,
  { noteId }: { noteId: Id<'sidebarItems'> },
): Promise<void> {
  const { doc } = await reconstructYDoc(ctx, noteId)
  try {
    const blocks = yDocToBlocks(doc, 'document')
    await syncNoteIndexesFromBlocks(ctx, {
      noteId,
      content: blocks,
    })
  } finally {
    doc.destroy()
  }
}
