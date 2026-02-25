import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFolder(
  ctx: CampaignMutationCtx,
  {
    name,
    parentId,
    iconName,
    color,
  }: {
    name: string
    parentId?: Id<'folders'>
    iconName?: string
    color?: string
  },
): Promise<{ folderId: Id<'folders'>; slug: string }> {
  const campaignId = ctx.campaign._id
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.folders,
    name,
  })

  const now = Date.now()
  const profileId = ctx.user.profile._id

  const folderId = await ctx.db.insert('folders', {
    name,
    slug: uniqueSlug,
    iconName: iconName ?? null,
    color: color ?? null,
    parentId: parentId ?? null,
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
