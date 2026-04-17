import { prepareSidebarItemCreate } from '../../sidebarItems/validation/orchestration'
import type { ParsedCreateParentTarget } from '../../sidebarItems/validation/parent'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
import { resolveOrCreateFolderPath } from '../../folders/functions/resolveOrCreateFolderPath'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFile(
  ctx: CampaignMutationCtx,
  {
    name,
    storageId,
    parentTarget,
    iconName,
    color,
  }: {
    name: SidebarItemName
    storageId?: Id<'_storage'>
    parentTarget: ParsedCreateParentTarget
    iconName?: SidebarItemIconName
    color?: SidebarItemColor
  },
): Promise<{ fileId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const resolvedParentId = await resolveOrCreateFolderPath(ctx, { parentTarget })
  const prepared = await prepareSidebarItemCreate(ctx, {
    parentId: resolvedParentId,
    name,
  })

  const userId = ctx.membership.userId

  let previewStorageId: Id<'_storage'> | null = null
  if (storageId) {
    const metadata = await ctx.db.system.get('_storage', storageId)
    if (metadata?.contentType?.toLowerCase().startsWith('image/')) {
      previewStorageId = storageId
    }
  }

  const fileId = await ctx.db.insert('sidebarItems', {
    campaignId: ctx.campaign._id,
    name: prepared.name,
    slug: prepared.slug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId: resolvedParentId,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.files,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: previewStorageId ? Date.now() : null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: userId,
  })

  await ctx.db.insert('files', {
    sidebarItemId: fileId,
    storageId: storageId ?? null,
  })

  await logEditHistory(ctx, {
    itemId: fileId,
    itemType: SIDEBAR_ITEM_TYPES.files,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { fileId, slug: prepared.slug }
}
