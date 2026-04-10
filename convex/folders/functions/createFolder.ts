import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_LOCATION, SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import type { AuthMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFolder(
  ctx: AuthMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
    campaignId,
  }: {
    name: string
    parentId: Id<'sidebarItems'> | null
    iconName?: string
    color?: string
    campaignId: Id<'campaigns'>
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: string }> {
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

  const folderId = await ctx.db.insert('sidebarItems', {
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    campaignId,
    type: SIDEBAR_ITEM_TYPES.folders,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId: null,
    previewLockedUntil: null,
    previewClaimToken: null,
    previewUpdatedAt: null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  await ctx.db.insert('folders', {
    sidebarItemId: folderId,
    inheritShares: false,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  await logEditHistory(ctx, {
    itemId: folderId,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    campaignId,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { folderId, slug: uniqueSlug }
}
