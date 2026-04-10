import { asyncMap } from 'convex-helpers'
import { getTopLevelBlocksByNote } from '../../blocks/functions/getTopLevelBlocksByNote'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enforceBlockSharePermissionsOrNull } from '../../blockShares/functions/getBlockPermissionLevel'
import { getBlockSharesByBlock } from '../../blockShares/functions/getBlockSharesForBlock'
import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import { SHARE_STATUS } from '../../blockShares/types'
import { requireCampaignMembership } from '../../functions'
import type { AuthQueryCtx } from '../../functions'
import type { BlockMeta, Note, NoteFromDb, NoteWithContent } from '../types'

export const enhanceNote = async (
  ctx: AuthQueryCtx,
  { note }: { note: NoteFromDb },
): Promise<Note> => {
  return enhanceBase(ctx, { item: note })
}

export const enhanceNoteWithContent = async (
  ctx: AuthQueryCtx,
  { note }: { note: Note },
): Promise<NoteWithContent> => {
  await requireCampaignMembership(ctx, note.campaignId)
  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, {
      initialParentId: note.parentId,
      isTrashed: note.location === SIDEBAR_ITEM_LOCATION.trash,
    }),
    getTopLevelBlocksByNote(ctx, { noteId: note._id }),
  ])

  const blockMetaEntries = await asyncMap(topLevelBlocks, async (block) => {
    const [result, blockShares] = await Promise.all([
      enforceBlockSharePermissionsOrNull(ctx, { block }),
      block.shareStatus === SHARE_STATUS.INDIVIDUALLY_SHARED
        ? getBlockSharesByBlock(ctx, { block })
        : Promise.resolve([]),
    ])
    if (!result) return null
    return {
      blockId: block.blockId,
      meta: {
        myPermissionLevel: result.permissionLevel,
        shareStatus: block.shareStatus ?? SHARE_STATUS.NOT_SHARED,
        sharedWith: blockShares.map((s) => s.campaignMemberId),
      } satisfies BlockMeta,
    }
  })
  const blockMeta: Record<string, BlockMeta> = {}
  for (const entry of blockMetaEntries) {
    if (entry) blockMeta[entry.blockId] = entry.meta
  }

  const content = topLevelBlocks.map((block) => block.content)
  return {
    ...note,
    content,
    blockMeta,
    ancestors,
  }
}
