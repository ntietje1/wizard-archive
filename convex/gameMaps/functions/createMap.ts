import { prepareSidebarItemCreate } from '../../sidebarItems/validation'
import type { ParsedCreateParentTarget } from '../../sidebarItems/createParentTarget'
import { resolveOrCreateFolderPath } from '../../folders/functions/resolveOrCreateFolderPath'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/sharedValidation'
import type { SidebarItemColor } from '../../sidebarItems/color'
import type { SidebarItemIconName } from '../../sidebarItems/icon'
import type { SidebarItemSlug } from '../../sidebarItems/slug'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createMap(
  ctx: CampaignMutationCtx,
  {
    name,
    imageStorageId,
    parentTarget,
    iconName,
    color,
  }: {
    name: SidebarItemName
    imageStorageId?: Id<'_storage'>
    parentTarget: ParsedCreateParentTarget
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
  },
): Promise<{ mapId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId: resolvedParentId,
    name,
  })

  const campaignId = ctx.campaign._id
  const userId = ctx.membership.userId

  const mapId = await ctx.db.insert('sidebarItems', {
    campaignId,
    name: prepared.name,
    slug: prepared.slug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId: resolvedParentId,
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

  return { mapId, slug: prepared.slug }
}
