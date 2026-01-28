import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../folders/folders'
import { getSidebarItemSharesForItem } from '../shares/itemShares'
import { getBookmark } from '../bookmarks/bookmarks'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import type { Id } from '../_generated/dataModel'
import type { QueryCtx } from '../_generated/server'
import type { Note, NoteFromDb, NoteWithContent } from './types'

export const enhanceNote = async (
  ctx: QueryCtx,
  note: NoteFromDb,
): Promise<Note> => {
  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  const [bookmark, shares] = await Promise.all([
    getBookmark(
      ctx,
      note.campaignId,
      campaignWithMembership.member._id,
      note._id,
    ),
    getSidebarItemSharesForItem(ctx, note.campaignId, note._id),
  ])

  return {
    ...note,
    isBookmarked: !!bookmark,
    shares,
  }
}

export const enhanceNoteWithContent = async (
  ctx: QueryCtx,
  note: Note,
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<NoteWithContent> => {
  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, note.campaignId, note.parentId),
    getTopLevelBlocksByNote(ctx, note._id, note.campaignId, viewAsPlayerId),
  ])
  const content = topLevelBlocks.map((block) => block.content)
  return {
    ...note,
    content,
    ancestors,
  }
}
