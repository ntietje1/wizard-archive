import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { resolveOrCreateSidebarParentPath } from '../../folders/functions/createFolder'
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
    parentId,
    parentPath,
    iconName,
    color,
  }: {
    name: string
    storageId?: Id<'_storage'>
    parentId: Id<'sidebarItems'> | null
    parentPath?: Array<string>
    iconName?: string
    color?: string
  },
): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> {
  name = name.trim()
  parentId = await resolveOrCreateSidebarParentPath(ctx, { parentId, parentPath })

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findUniqueSidebarItemSlug(ctx, {
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
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
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

  return { fileId, slug: uniqueSlug }
}
