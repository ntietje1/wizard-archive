import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { deleteBlocksByNote } from '../blocks/blocks'
import {
  getSidebarItemById,
  isValidSidebarParent,
} from '../sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/types'
import { findUniqueSlug, shortenId } from '../common/slug'
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
    categoryId?: Id<'tagCategories'>
    parentId?: SidebarItemId
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
    if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.notes, parentItem.type)) {
      throw new Error('Invalid parent type')
    }
  }

  const noteId = await ctx.db.insert('notes', {
    name: input.name || '',
    slug: uniqueSlug,
    parentId: input.parentId,
    categoryId: input.categoryId,
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
    parentId?: SidebarItemId
  },
): Promise<Id<'notes'>> => {
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

  if (input.parentId !== undefined) {
    if (input.parentId) {
      const parentItem = await getSidebarItemById(
        ctx,
        note.campaignId,
        input.parentId,
      )
      if (!parentItem) {
        throw new Error('Parent not found')
      }
      if (!isValidSidebarParent(SIDEBAR_ITEM_TYPES.notes, parentItem.type)) {
        throw new Error('Invalid parent type')
      }
    }
    updates.parentId = input.parentId
  }

  await ctx.db.patch(input.noteId, updates)
  return input.noteId
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
