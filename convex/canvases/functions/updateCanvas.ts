import {
  prepareSidebarItemRename,
  requireItemAccess,
} from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/sharedValidation'
import type { EditHistoryChange } from '../../editHistory/types'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateCanvas(
  ctx: CampaignMutationCtx,
  {
    canvasId,
    name,
    iconName,
    color,
  }: {
    canvasId: Id<'sidebarItems'>
    name?: SidebarItemName
    iconName?: string | null
    color?: string | null
  },
): Promise<{ canvasId: Id<'sidebarItems'>; slug: string }> {
  const rawItem = await getSidebarItem(ctx, canvasId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')
  const canvas = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, {
      item: canvas,
      newName: name,
    })
    if (rename) {
      updates.name = rename.name
      newSlug = rename.slug
      updates.slug = rename.slug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: canvas.name, to: rename.name },
      })
    }
  }
  if (iconName !== undefined && iconName !== canvas.iconName) {
    updates.iconName = iconName
    changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: canvas.iconName, to: iconName },
    })
  }
  if (color !== undefined && color !== canvas.color) {
    updates.color = color
    changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: canvas.color, to: color },
    })
  }

  if (changes.length === 0) {
    return { canvasId: canvas._id, slug: canvas.slug }
  }

  await ctx.db.patch('sidebarItems', canvas._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: canvas._id,
    itemType: SIDEBAR_ITEM_TYPES.canvases,
    changes,
  })

  return { canvasId: canvas._id, slug: newSlug ?? canvas.slug }
}
