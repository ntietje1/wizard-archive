import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { requireCampaignMembership } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { AuthMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateCanvas(
  ctx: AuthMutationCtx,
  {
    canvasId,
    name,
    iconName,
    color,
  }: {
    canvasId: Id<'canvases'>
    name?: string
    iconName?: string | null
    color?: string | null
  },
): Promise<{ canvasId: Id<'canvases'>; slug: string }> {
  const canvasFromDb = await ctx.db.get(canvasId)
  if (!canvasFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Canvas not found')
  await requireCampaignMembership(ctx, canvasFromDb.campaignId)
  const canvas = await requireItemAccess(ctx, {
    rawItem: canvasFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'canvases'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item: canvas,
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
    return { canvasId: canvas._id, slug: canvas.slug }
  }

  await ctx.db.patch(canvas._id, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  const historyBase = {
    itemId: canvas._id,
    itemType: SIDEBAR_ITEM_TYPES.canvases,
    campaignId: canvas.campaignId,
  } as const

  if (name !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.renamed,
      metadata: { from: canvas.name, to: name.trim() },
    })
  }
  if (iconName !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: canvas.iconName, to: iconName },
    })
  }
  if (color !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: canvas.color, to: color },
    })
  }

  return { canvasId: canvas._id, slug: newSlug ?? canvas.slug }
}
