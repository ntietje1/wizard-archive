import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
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
    mapId: Id<'gameMaps'>
    name?: string
    imageStorageId?: Id<'_storage'> | null
    iconName?: string | null
    color?: string | null
  },
): Promise<{ mapId: Id<'gameMaps'>; slug: string }> {
  const mapFromDb = await ctx.db.get(mapId)
  const map = await requireItemAccess(ctx, {
    rawItem: mapFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'gameMaps'>>> = {}

  if (name !== undefined) {
    updates.name = name
    newSlug = await validateSidebarItemRename(ctx, {
      item: map,
      newName: name,
    })
    updates.slug = newSlug
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

  if (Object.keys(updates).length === 0) {
    return { mapId: map._id, slug: map.slug }
  }

  await ctx.db.patch(mapId, {
    ...updates,
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  })
  return { mapId: map._id, slug: newSlug ?? map.slug }
}
