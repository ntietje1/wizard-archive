import { CAMPAIGN_MEMBER_ROLE } from '../campaigns/types'
import { requireCampaignMembership } from '../campaigns/campaigns'
import { getSidebarItemById } from '../sidebarItems/sidebarItems'
import { validateSidebarItemName } from '../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../sidebarItems/baseTypes'
import {
  findUniqueNoteSlug,
  findUniqueSlug,
  resolveSlugBasis,
} from '../common/slug'
import { deleteBlocksByNote } from '../blocks/blocks'
import { enhanceSidebarItem } from '../sidebarItems/helpers'
import {
  hasViewPermission,
  requireFullAccessPermission,
} from '../shares/itemShares'
import { enhanceNoteWithContent } from './helpers'
import type { MutationCtx } from '../_generated/server'
import type { NoteWithContent } from './types'
import type { Doc, Id } from '../_generated/dataModel'
import type { Ctx } from '../common/types'

export const createNote = async (
  ctx: MutationCtx,
  input: {
    name?: string
    campaignId: Id<'campaigns'>
    parentId?: Id<'folders'>
    iconName?: string
    color?: string
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> => {
  await requireCampaignMembership(
    ctx,
    { campaignId: input.campaignId },
    { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM, CAMPAIGN_MEMBER_ROLE.Player] },
  )

  if (input.parentId) {
    const parentItem = await getSidebarItemById(
      ctx,
      input.campaignId,
      input.parentId,
    )
    if (!parentItem) {
      throw new Error('Parent not found')
    }
    await requireFullAccessPermission(ctx, parentItem)
  } else {
    await requireCampaignMembership(
      ctx,
      { campaignId: input.campaignId },
      { allowedRoles: [CAMPAIGN_MEMBER_ROLE.DM] },
    )
  }

  const uniqueSlug = await findUniqueSlug(
    resolveSlugBasis(input.name),
    async (slug) => {
      const conflict = await ctx.db
        .query('notes')
        .withIndex('by_campaign_slug', (q) =>
          q.eq('campaignId', input.campaignId).eq('slug', slug),
        )
        .unique()
      return conflict !== null
    },
  )

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
  const rawNote = await ctx.db.get(input.noteId)
  if (!rawNote) {
    throw new Error('Note not found')
  }

  const note = await enhanceSidebarItem(ctx, rawNote)
  await requireFullAccessPermission(ctx, note)

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
  viewAsPlayerId?: Id<'campaignMembers'>,
): Promise<NoteWithContent | null> => {
  const rawNote = await ctx.db.get(noteId)
  if (!rawNote) return null

  const note = await enhanceSidebarItem(ctx, rawNote)
  const hasPermission = await hasViewPermission(ctx, note)
  if (!hasPermission) return null
  return enhanceNoteWithContent(ctx, note, viewAsPlayerId)
}

export async function deleteNote(
  ctx: MutationCtx,
  noteId: Id<'notes'>,
): Promise<Id<'notes'>> {
  const rawNote = await ctx.db.get(noteId)
  if (!rawNote) {
    throw new Error('Note not found')
  }

  const note = await enhanceSidebarItem(ctx, rawNote)
  await requireFullAccessPermission(ctx, note)

  await deleteBlocksByNote(ctx, noteId, note.campaignId)
  await ctx.db.delete(noteId)

  return noteId
}
