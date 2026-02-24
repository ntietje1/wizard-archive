import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateFile(
  ctx: CampaignMutationCtx,
  {
    fileId,
    name,
    storageId,
    iconName,
    color,
  }: {
    fileId: Id<'files'>
    name?: string
    storageId?: Id<'_storage'>
    iconName?: string
    color?: string
  },
): Promise<{ fileId: Id<'files'>; slug: string }> {
  const fileFromDb = await ctx.db.get(fileId)
  const file = await requireItemAccess(ctx, {
    rawItem: fileFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const updates: Partial<WithoutSystemFields<Doc<'files'>>> = {
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    updates.name = name
    updates.slug = await validateSidebarItemRename(ctx, {
      item: file,
      newName: name,
    })
  }
  if (storageId !== undefined) {
    updates.storageId = storageId
  }
  if (iconName !== undefined) {
    updates.iconName = iconName
  }
  if (color !== undefined) {
    updates.color = color
  }
  await ctx.db.patch(fileId, updates)
  return { fileId: file._id, slug: updates.slug ?? file.slug }
}
