import { getTopLevelBlocksByNote } from '../blocks/blocks'
import { getSidebarItemAncestors } from '../folders/folders'
import {
  getSidebarItemPermissionLevel,
  getSidebarItemSharesForItem,
  hasEditPermission,
} from '../shares/itemShares'
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
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<NoteWithContent> => {
  const canEdit = await hasEditPermission(ctx, note)

  const [ancestors = [], topLevelBlocks = []] = await Promise.all([
    getSidebarItemAncestors(ctx, note.campaignId, note.parentId),
    getTopLevelBlocksByNote(
      ctx,
      note._id,
      note.campaignId,
      viewAsPlayerId,
      canEdit,
    ),
  ])
  const content = topLevelBlocks.map((block) => block.content)
  return {
    ...note,
    content,
    ancestors,
  }
}
