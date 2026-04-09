import { requireItemAccess, validateSidebarItemRename } from '../../sidebarItems/validation'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { EditHistoryChange } from '../../editHistory/types'
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
  const mapFromDb = await ctx.db.get("gameMaps", mapId)
  if (!mapFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  await requireCampaignMembership(ctx, mapFromDb.campaignId)
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'gameMaps'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const trimmedName = name.trim()
    if (trimmedName !== map.name) {
      updates.name = trimmedName
      newSlug = await validateSidebarItemRename(ctx, {
        item: map,
        newName: trimmedName,
      })
      updates.slug = newSlug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: map.name, to: trimmedName },
      })
    }
  }
  if (imageStorageId !== undefined && imageStorageId !== map.imageStorageId) {
    updates.imageStorageId = imageStorageId
    updates.previewStorageId = imageStorageId
    changes.push({
      action:
        imageStorageId !== null
          ? EDIT_HISTORY_ACTION.map_image_changed
          : EDIT_HISTORY_ACTION.map_image_removed,
      metadata: null,
    })
  }
  if (iconName !== undefined && iconName !== map.iconName) {
    updates.iconName = iconName
    changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: map.iconName, to: iconName },
    })
  }
  if (color !== undefined && color !== map.color) {
    updates.color = color
    changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: map.color, to: color },
    })
  }

  if (changes.length === 0) {
    return { mapId: map._id, slug: map.slug }
  }

  await ctx.db.patch("gameMaps", mapId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  await logEditHistory(ctx, {
    itemId: map._id,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    campaignId: map.campaignId,
    changes,
  })

  return { mapId: map._id, slug: newSlug ?? map.slug }
}
