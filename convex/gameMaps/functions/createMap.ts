import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
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
    name: string
    imageStorageId?: Id<'_storage'>
    parentId: Id<'sidebarItems'> | null
    iconName?: string
    color?: string
  },
): Promise<{ mapId: Id<'sidebarItems'>; slug: string }> {
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
    name,
  })

  const campaignId = ctx.campaign._id
  const userId = ctx.membership.userId

  const mapId = await ctx.db.insert('sidebarItems', {
    campaignId,
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
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
    createdBy: userId,
  })

  await ctx.db.insert('gameMaps', {
    sidebarItemId: mapId,
    imageStorageId: imageStorageId ?? null,
  })

  await logEditHistory(ctx, {
    itemId: mapId,
    itemType: SIDEBAR_ITEM_TYPES.gameMaps,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { mapId, slug: uniqueSlug }
}
