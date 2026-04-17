import { prepareSidebarItemRename, requireItemAccess } from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { ERROR_CODE, throwClientError } from '../../errors'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/sharedValidation'
import type { SidebarItemColor } from '../../sidebarItems/color'
import type { SidebarItemIconName } from '../../sidebarItems/icon'
import type { SidebarItemSlug } from '../../sidebarItems/slug'
import type { EditHistoryChange } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateNote(
  ctx: CampaignMutationCtx,
  {
    noteId,
    name,
    iconName,
    color,
  }: {
    noteId: Id<'sidebarItems'>
    name?: SidebarItemName
    iconName?: SidebarItemIconName | null
    color?: SidebarItemColor | null
  },
): Promise<{ noteId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const rawItem = await getSidebarItem(ctx, noteId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Note not found')
  const note = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: SidebarItemSlug | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, {
      item: note,
      newName: name,
    })
    if (rename) {
      updates.name = rename.name
      newSlug = rename.slug
      updates.slug = rename.slug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: note.name, to: rename.name },
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
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: note._id,
    itemType: SIDEBAR_ITEM_TYPES.notes,
    changes,
  })

  return { noteId: note._id, slug: newSlug ?? note.slug }
}
