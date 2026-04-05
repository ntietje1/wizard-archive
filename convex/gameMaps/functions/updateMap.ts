import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { WithoutSystemFields } from 'convex/server'
import type { AuthMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateMap(
  ctx: AuthMutationCtx,
  {
    mapId,
    name,
    imageStorageId,
    iconName,
    color,
  }: {
    mapId: Id<'gameMaps'>
    name?: string
    imageStorageId?: Id<'_storage'> | null
    iconName?: string | null
    color?: string | null
  },
): Promise<{ mapId: Id<'gameMaps'>; slug: string }> {
  const mapFromDb = await ctx.db.get(mapId)
  if (!mapFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireCampaignMembership(ctx, mapFromDb.campaignId)
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'gameMaps'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item: map,
      newName: trimmedName,
    })
    updates.slug = newSlug
  }
  if (imageStorageId !== undefined) {
    updates.imageStorageId = imageStorageId
    if (imageStorageId) {
      updates.thumbnailStorageId = imageStorageId
    }
  }
  if (iconName !== undefined) {
    updates.iconName = iconName
  }
  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    return { mapId: map._id, slug: map.slug }
  }

  await ctx.db.patch(mapId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  const historyBase = {
    itemId: map._id,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    campaignId: map.campaignId,
  } as const

  if (name !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.renamed,
      metadata: { from: map.name, to: name.trim() },
    })
  }
  if (imageStorageId !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.image_changed,
    })
  }
  if (iconName !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: map.iconName, to: iconName },
    })
  }
  if (color !== undefined) {
    await logEditHistory(ctx, {
      ...historyBase,
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: map.color, to: color },
    })
  }

  return { mapId: map._id, slug: newSlug ?? map.slug }
}
