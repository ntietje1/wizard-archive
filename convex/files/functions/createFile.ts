import {
  findUniqueSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import {
  SIDEBAR_ITEM_LOCATION,
  SIDEBAR_ITEM_TYPES,
} from '../../sidebarItems/types/baseTypes'
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

  let previewStorageId: Id<'_storage'> | null = null
  if (storageId) {
    const metadata = await ctx.db.system.get(storageId)
    if (metadata?.contentType?.startsWith('image/')) {
      previewStorageId = storageId
    }
  }

  const fileId = await ctx.db.insert('files', {
    campaignId,
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    storageId: storageId ?? null,
    parentId,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.files,
    location: SIDEBAR_ITEM_LOCATION.sidebar,
    previewStorageId,
    previewLockedUntil: null,
    previewUpdatedAt: previewStorageId ? Date.now() : null,
    deletionTime: null,
    deletedBy: null,
    updatedTime: null,
    updatedBy: null,
    createdBy: profileId,
  })

  return { fileId, slug: uniqueSlug }
}
