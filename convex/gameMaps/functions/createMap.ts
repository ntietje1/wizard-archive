import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_TYPES,
} from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createMap(
  ctx: AuthMutationCtx,
  {
    name,
    imageStorageId,
    parentId,
    iconName,
    color,
    campaignId,
  }: {
    name: string
    imageStorageId?: Id<'_storage'>
    parentId: Id<'folders'> | null
    iconName?: string
    color?: string
    campaignId: Id<'campaigns'>
  },
): Promise<{ mapId: Id<'gameMaps'>; slug: string }> {
  name = name.trim()

  await validateSidebarCreateParent(ctx, { campaignId, parentId })
  await validateSidebarItemName(ctx, {
    campaignId,
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name,
    campaignId,
  })

  const profileId = ctx.user.profile._id

  const mapId = await ctx.db.insert('gameMaps', {
    campaignId,
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    imageStorageId: imageStorageId ?? null,
    parentId,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.gameMaps,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: imageStorageId ?? null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  await logEditHistory(ctx, {
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    campaignId,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { mapId, slug: uniqueSlug }
}
