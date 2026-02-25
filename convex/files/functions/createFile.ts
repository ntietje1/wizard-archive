import {
  findNewSidebarItemSlug,
  validateSidebarCreateParent,
  validateSidebarItemName,
} from '../../sidebarItems/validation'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { CampaignMutationCtx } from '../../functions'
import type { Id } from '../../_generated/dataModel'

export async function createFile(
  ctx: CampaignMutationCtx,
  {
    name,
    storageId,
    parentId,
    iconName,
    color,
  }: {
    name: string
    storageId?: Id<'_storage'>
    parentId?: Id<'folders'>
    iconName?: string
    color?: string
  },
): Promise<{ fileId: Id<'files'>; slug: string }> {
  const campaignId = ctx.campaign._id
  name = name.trim()

  await validateSidebarCreateParent(ctx, { parentId })
  await validateSidebarItemName(ctx, {
    parentId,
    name,
  })

  const uniqueSlug = await findNewSidebarItemSlug(ctx, {
    type: SIDEBAR_ITEM_TYPES.files,
    name,
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
    parentId: parentId ?? null,
    allPermissionLevel: null,
    type: SIDEBAR_ITEM_TYPES.files,
    updatedTime: now,
    updatedBy: profileId,
    createdBy: profileId,
  })

  return { fileId, slug: uniqueSlug }
}
