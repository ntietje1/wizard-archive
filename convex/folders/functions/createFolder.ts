import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
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
    parentId: Id<'folders'> | null
    iconName?: string
    color?: string
    campaignId: Id<'campaigns'>
  },
): Promise<{ folderId: Id<'folders'>; slug: string }> {
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId, campaignId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
    campaignId,
  })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.folders,
    name,
    campaignId,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

  const folderId = await ctx.db.insert('folders', {
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId,
    allPermissionLevel: null,
    inheritShares: false,
    campaignId,
    type: SIDEBAR_ITEM_TYPES.folders,
    updatedTime: now,
    updatedBy: profileId,
    createdBy: profileId,
  })

  return { folderId, slug: uniqueSlug }
}
