import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
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

  await validateSidebarCreateParent(ctx, { parentId, campaignId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
    campaignId,
  })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.files,
    name,
    campaignId,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

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
    updatedTime: now,
    updatedBy: profileId,
    createdBy: profileId,
  })

  return { fileId, slug: uniqueSlug }
}
