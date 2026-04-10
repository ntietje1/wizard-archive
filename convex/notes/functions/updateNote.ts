import { requireItemAccess, validateSidebarItemRename } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { ERROR_CODE, throwClientError } from '../../errors'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { EditHistoryChange } from '../../editHistory/types'
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
    noteId: Id<'sidebarItems'>
    name?: string
    iconName?: string | null
    color?: string | null
  },
): Promise<{ noteId: Id<'sidebarItems'>; slug: string }> {
  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  await requireCampaignMembership(ctx, rawItem.campaignId)
  const note = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const trimmedName = name.trim()
    if (trimmedName !== note.name) {
      updates.name = trimmedName
      newSlug = await validateSidebarItemRename(ctx, {
        item: note,
        newName: trimmedName,
      })
      updates.slug = newSlug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: note.name, to: trimmedName },
      })
    }
  }

  if (iconName !== undefined && iconName !== note.iconName) {
    updates.iconName = iconName
    changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: note.iconName, to: iconName },
    })
  }

  if (color !== undefined && color !== note.color) {
    updates.color = color
    changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: note.color, to: color },
    })
  }

  if (changes.length === 0) {
    return { noteId: note._id, slug: note.slug }
  }

  await ctx.db.patch('sidebarItems', noteId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  await logEditHistory(ctx, {
    itemId: note._id,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    campaignId: note.campaignId,
    changes,
  })

  return { noteId: note._id, slug: newSlug ?? note.slug }
}
