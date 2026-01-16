import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import {
  getSidebarItemById,
  validateSidebarItemName,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { findUniqueSlug, shortenId } from '../common/slug'
import { deleteBlocksByNote } from '../blocks/blocks'
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

  await validateSidebarItemName(
    ctx,
    input.campaignId,
    input.parentId,
    input.name,
  )

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
    await validateSidebarItemName(
      ctx,
      note.campaignId,
      note.parentId,
      input.name,
      note._id,
    )

    const slugBasis =
      input.name && input.name.trim() !== ''
        ? input.name
        : shortenId(input.noteId)

    const uniqueSlug = await findUniqueSlug(slugBasis, async (slug) => {
      const conflict = await ctx.db
        .query('notes')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', note.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null && conflict._id !== input.noteId
    })

    updates.slug = uniqueSlug
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

  await requireCampaignMembership(
    ctx,
    { campaignId: note.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
  )

  return note
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
