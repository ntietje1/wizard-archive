import { saveAllBlocksForNote } from '../../blocks/functions/saveAllBlocksForNote'
import { reconstructBlockTree } from '../../blocks/functions/reconstructBlockTree'
import { syncNoteLinks } from '../../links/functions/syncNoteLinks'
import { saveAllNoteValuesForNote } from '../../noteValues/functions/saveAllNoteValuesForNote'
import { isActiveSidebarItem } from '../../sidebarItems/types/status'
import type { Doc, Id } from '../../_generated/dataModel'
import type { MutationCtx } from '../../_generated/server'
import type { Block, CustomBlock } from '../../blocks/types'

type CampaignScopedMutationCtx = Pick<MutationCtx, 'db'> & {
  campaign: Pick<Doc<'campaigns'>, '_id'>
}

export async function syncNoteDerivedDataFromPersistedBlocks(
  ctx: CampaignScopedMutationCtx,
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
  ctx: CampaignScopedMutationCtx,
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
