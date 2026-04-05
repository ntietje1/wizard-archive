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

export async function createFile(
  ctx: AuthMutationCtx,
  {
    name,
    storageId,
    parentId,
    iconName,
    color,
    campaignId,
  }: {
    name: string
    storageId?: Id<'_storage'>
    parentId: Id<'folders'> | null
    iconName?: string
    color?: string
    campaignId: Id<'campaigns'>
  },
): Promise<{ fileId: Id<'files'>; slug: string }> {
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

  // For image files, reuse the original as the thumbnail
  let thumbnailStorageId: Id<'_storage'> | undefined
  if (storageId) {
    const metadata = await ctx.db.system.get(storageId)
    if (metadata?.contentType?.startsWith('image/')) {
      thumbnailStorageId = storageId
    }
    // TODO: For PDFs, generate a first-page thumbnail via pdf.js
    // TODO: For videos, extract a frame via ffmpeg
  }

  const fileId = await ctx.db.insert('files', {
    campaignId,
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    storageId: storageId ?? null,
    thumbnailStorageId,
    parentId,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.files,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  await logEditHistory(ctx, {
    itemId: fileId,
    itemType: SIDEBAR_ITEM_TYPES.files,
    campaignId,
    action: EDIT_HISTORY_ACTION.created,
  })

  return { fileId, slug: uniqueSlug }
}
