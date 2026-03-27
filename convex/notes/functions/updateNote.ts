import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { ERROR_CODE, throwClientError } from '../../errors'
import type { AuthMutationCtx } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateNote(
  ctx: AuthMutationCtx,
  {
    noteId,
    name,
    iconName,
    color,
  }: {
    noteId: Id<'notes'>
    name?: string
    iconName?: string | null
    color?: string | null
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> {
  const noteFromDb = await ctx.db.get(noteId)
  if (!noteFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireCampaignMembership(ctx, noteFromDb.campaignId)
  const note = await requireItemAccess(ctx, {
    rawItem: noteFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'notes'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item: note,
      newName: trimmedName,
    })
    updates.slug = newSlug
  }

  if (iconName !== undefined) {
    updates.iconName = iconName
  }

  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    return { noteId: note._id, slug: note.slug }
  }

  await ctx.db.patch(note._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })
  return { noteId: note._id, slug: newSlug ?? note.slug }
}
