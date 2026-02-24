import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateNote(
  ctx: CampaignMutationCtx,
  {
    noteId,
    name,
    iconName,
    color,
  }: {
    noteId: Id<'notes'>
    name?: string
    iconName?: string
    color?: string | null
  },
): Promise<{ noteId: Id<'notes'>; slug: string }> {
  const noteFromDb = await ctx.db.get(noteId)
  const note = await requireItemAccess(ctx, {
    rawItem: noteFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const updates: Partial<Doc<'notes'>> = {
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    updates.name = name
    updates.slug = await validateSidebarItemRename(ctx, {
      item: note,
      newName: name,
    })
  }

  if (iconName !== undefined) {
    updates.iconName = iconName
  }

  if (color !== undefined) {
    updates.color = color === null ? undefined : color
  }

  await ctx.db.patch(note._id, updates)
  return { noteId: note._id, slug: updates.slug ?? note.slug }
}
