import {
  prepareSidebarItemRename,
  requireItemAccess,
} from '../../sidebarItems/validation/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { ERROR_CODE, throwClientError } from '../../errors'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import type { EditHistoryChange } from '../../editHistory/types'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateMap(
  ctx: CampaignMutationCtx,
  {
    mapId,
    name,
    imageStorageId,
    iconName,
    color,
  }: {
    mapId: Id<'sidebarItems'>
    name?: SidebarItemName
    imageStorageId?: Id<'_storage'> | null
    iconName?: SidebarItemIconName | null
    color?: SidebarItemColor | null
  },
): Promise<{ mapId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const rawItem = await getSidebarItem(ctx, mapId)
  if (!rawItem || rawItem.type !== SIDEBAR_ITEM_TYPES.gameMaps)
    throwClientError(ERROR_CODE.NOT_FOUND, 'Map not found')
  const map = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: SidebarItemSlug | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, {
      item: map,
      newName: name,
    })
    if (rename) {
      updates.name = rename.name
      newSlug = rename.slug
      updates.slug = rename.slug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: map.name, to: rename.name },
      })
    }
  }
  if (imageStorageId !== undefined && imageStorageId !== map.imageStorageId) {
    const ext = await ctx.db
      .query('gameMaps')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', mapId))
      .unique()
    if (ext) {
      await ctx.db.patch('gameMaps', ext._id, { imageStorageId })
    }
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

  await ctx.db.patch('sidebarItems', mapId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: map._id,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    changes,
  })

  return { mapId: map._id, slug: newSlug ?? map.slug }
}
