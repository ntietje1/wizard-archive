import { getTopLevelBlocksByNote } from '../../blocks/functions/getTopLevelBlocksByNote'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { getBlockPermissionLevel } from '../../blockShares/functions/getBlockPermissionLevel'
import { getBlockSharesForBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import { SHARE_STATUS } from '../../blockShares/types'
import { requireCampaignMembership } from '../../functions'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { BlockMeta, Note, NoteFromDb, NoteWithContent } from '../types'

export const enhanceNote = async (
  ctx: AuthQueryCtx,
  {
    note,
    sharesMap,
    bookmarkIds,
  }: {
    note: NoteFromDb
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<Note> => {
  return enhanceBase(ctx, { item: note, sharesMap, bookmarkIds })
}

export const enhanceNoteWithContent = async (
  ctx: AuthQueryCtx,
  { note }: { note: Note },
): Promise<NoteWithContent> => {
  await requireCampaignMembership(ctx, note.campaignId)
  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: note.parentId,
      isTrashed: !!note.deletionTime,
    }),
    getTopLevelBlocksByNote(ctx, { noteId: note._id }),
  ])

  const blockMeta: Record<string, BlockMeta> = {}
  await Promise.all(
    topLevelBlocks.map(async (block) => {
      const [myPermissionLevel, blockShares] = await Promise.all([
        getBlockPermissionLevel(ctx, { block }),
        block.shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED
          ? getBlockSharesForBlock(ctx, { blockId: block._id })
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
