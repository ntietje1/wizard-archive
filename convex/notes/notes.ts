import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { validateSidebarItemName } from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { findUniqueNoteSlug, findUniqueSlug } from '../common/slug'
import { deleteBlocksByNote } from '../blocks/blocks'
import { getBookmark } from '../bookmarks/bookmarks'
import type { SidebarItemId } from '../sidebarItems/types'
import type { MutationCtx } from '../_generated/server'
import type { Note } from './types'
import type { Doc, Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'

export const createNote = async (
  ctx: MutationCtx,
  input: {
    name?: string
    campaignId: Id<'campaigns'>
    parentId?: SidebarItemId
    iconName?: string
    color?: string
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: input.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const slugBasis =
    input.name && input.name.trim() !== '' ? input.name : crypto.randomUUID() // use a uuid if the name is blank

  const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
    const conflict = await ctx.db
      .query('notes')
      .withIndex('by_campaign_slug', (q) =>
        q.eq('campaignId', input.campaignId).eq('slug', slug),
      )
      .unique()
    return conflict !== null
  })

  if (input.parentId) {
    const parentItem = await getSidebarItemById(
      ctx,
      input.campaignId,
      input.parentId,
    )
    if (!parentItem) {
      throw new Error('Parent not found')
    }
  }

  await validateSidebarItemName({
    ctx,
    campaignId: input.campaignId,
    parentId: input.parentId,
    name: input.name,
  })

  const noteId = await ctx.db.insert('notes', {
    name: input.name,
    slug: uniqueSlug,
    parentId: input.parentId,
    iconName: input.iconName,
    color: input.color,
    updatedAt: Date.now(),
    campaignId: input.campaignId,
    type: SIDEBAR_ITEM_TYPES.notes,
  })

  return { noteId, slug: uniqueSlug }
}

export const updateNote = async (
  ctx: MutationCtx,
  input: {
    noteId: Id<'notes'>
    name?: string
    iconName?: string
    color?: string | null
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> => {
  const note = await ctx.db.get(input.noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const now = Date.now()
  const updates: Partial<Doc<'notes'>> = {
    updatedAt: now,
  }

  if (input.name !== undefined) {
    updates.name = input.name
    await validateSidebarItemName({
      ctx,
      campaignId: note.campaignId,
      parentId: note.parentId,
      name: input.name,
      excludeId: note._id,
    })

    updates.slug = await findUniqueNoteSlug(
      ctx,
      note.campaignId,
      input.name,
      input.noteId,
    )
  }

  if (input.iconName !== undefined) {
    updates.iconName = input.iconName
  }

  if (input.color !== undefined) {
    updates.color = input.color === null ? undefined : input.color
  }

  await ctx.db.patch(input.noteId, updates)
  return { noteId: input.noteId, slug: updates.slug || note.slug }
}
export const getNote = async (
  ctx: Ctx,
  noteId: Id<'notes'>,
): Promise<Note | null> => {
  const note = await ctx.db.get(noteId)
  if (!note) {
    return null
  }

  const { campaignWithMembership } = await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const bookmark = await getBookmark(
    ctx,
    note.campaignId,
    campaignWithMembership.member._id,
    note._id,
  )
  return {
    ...note,
    isBookmarked: !!bookmark,
  }
}

export const getNoteBySlug = async (
  ctx: Ctx,
  campaignId: Id<'campaigns'>,
  slug: string,
): Promise<Note | null> => {
  await requireCampaignMembership(
    ctx,
    { campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  const note = await ctx.db
    .query('notes')
    .withIndex('by_campaign_slug', (q) =>
      q.eq('campaignId', campaignId).eq('slug', slug),
    )
    .unique()

  if (!note) {
    return null
  }

  return getNote(ctx, note._id)
}

export async function deleteNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
): Promise<Id<'notes'>> {
  const note = await ctx.db.get(noteId)
  if (!note) {
    throw new Error('Note not found')
  }

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  await deleteBlocksByNote(ctx, noteId, note.campaignId)
  await ctx.db.delete(noteId)

  return noteId
}
