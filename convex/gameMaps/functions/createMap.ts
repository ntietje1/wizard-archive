import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createMap(
  ctx: CampaignMutationCtx,
  {
    name,
    imageStorageId,
    parentId,
    iconName,
    color,
  }: {
    name?: string
    imageStorageId?: Id<'_storage'>
    parentId?: Id<'folders'>
    iconName?: string
    color?: string
  },
): Promise<{ mapId: Id<'gameMaps'>; slug: string }> {
  const campaignId = ctx.campaign._id

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, { parentId, name })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    name,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

  const mapId = await ctx.db.insert('gameMaps', {
    campaignId,
    name: name ?? 'Untitled Map',
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    imageStorageId: imageStorageId ?? null,
    parentId: parentId ?? null,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    _updatedTime: now,
    _updatedBy: profileId,
    _createdBy: profileId,
  })

  return { mapId, slug: uniqueSlug }
}
