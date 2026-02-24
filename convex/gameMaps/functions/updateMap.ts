import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
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
    mapId: Id<'gameMaps'>
    name?: string
    imageStorageId?: Id<'_storage'>
    iconName?: string
    color?: string
  },
): Promise<{ mapId: Id<'gameMaps'>; slug: string }> {
  const mapFromDb = await ctx.db.get(mapId)
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const updates: Partial<Doc<'gameMaps'>> = {
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    updates.name = name
    updates.slug = await validateSidebarItemRename(ctx, {
      item: map,
      newName: name,
    })
  }
  if (imageStorageId !== undefined) {
    updates.imageStorageId = imageStorageId
  }
  if (iconName !== undefined) {
    updates.iconName = iconName
  }
  if (color !== undefined) {
    updates.color = color
  }
  await ctx.db.patch(mapId, updates)
  return { mapId: map._id, slug: updates.slug ?? map.slug }
}
