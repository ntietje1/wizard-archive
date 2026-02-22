import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../folders/folders'
import {
  getBlockPermissionLevel,
  getBlockSharesForBlock,
} from '../shares/blockShares'
import { enhanceBase } from '../sidebarItems/enhanceBase'
import { SHARE_STATUS } from '../shares/types'
import type { CampaignQueryCtx } from '../functions'
import type { BlockMeta, Note, NoteFromDb, NoteWithContent } from './types'

export const enhanceNote = async (
  ctx: CampaignQueryCtx,
  note: NoteFromDb,
): Promise<Note> => {
  return enhanceBase(ctx, note)
}

export const enhanceNoteWithContent = async (
  ctx: CampaignQueryCtx,
  note: Note,
): Promise<NoteWithContent> => {
  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, note.parentId),
    getTopLevelBlocksByNote(ctx, note._id, note.campaignId),
  ])

  const blockMeta: Record<string, BlockMeta> = {}
  await Promise.all(
    topLevelBlocks.map(async (block) => {
      const [myPermissionLevel, blockShares] = await Promise.all([
        getBlockPermissionLevel(ctx, block),
        block.shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED
          ? getBlockSharesForBlock(ctx, note.campaignId, block._id)
          : Promise.resolve([]),
      ])
      blockMeta[block.blockId] = {
        myPermissionLevel,
        shareStatus: block.shareStatus ?? SHARE_STATUS.NOT_SHARED,
        sharedWith: blockShares.map((s) => s.campaignMemberId),
      }
    }),
  )

  const content = topLevelBlocks.map((block) => block.content)
  return {
    ...note,
    content,
    blockMeta,
    ancestors,
  }
}
