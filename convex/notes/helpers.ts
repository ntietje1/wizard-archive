import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../folders/folders'
import {
  getBlockPermissionLevel,
  getBlockSharesForBlock,
} from '../shares/blockShares'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
} from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { SHARE_STATUS } from '../shares/types'
import type { QueryCtx } from '../_generated/server'
import type { BlockMeta, Note, NoteFromDb, NoteWithContent } from './types'

export const enhanceNote = async (
  ctx: QueryCtx,
  note: NoteFromDb,
): Promise<Note> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const [bookmark, shares, myPermissionLevel] = await Promise.all([
    getBookmark(
      ctx,
      note.campaignId,
      campaignWithMembership.member._id,
      note._id,
    ),
    getSidebarItemSharesForItem(ctx, note.campaignId, note._id),
    getSidebarItemPermissionLevel(ctx, note),
  ])

  return {
    ...note,
    isBookmarked: !!bookmark,
    shares,
    myPermissionLevel,
  }
}

export const enhanceNoteWithContent = async (
  ctx: QueryCtx,
  note: Note,
): Promise<NoteWithContent> => {
  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, note.campaignId, note.parentId),
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
