import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateFolder(
  ctx: CampaignMutationCtx,
  { folderId, name }: { folderId: Id<'folders'>; name?: string },
): Promise<{ folderId: Id<'folders'>; slug: string }> {
  const folderFromDb = await ctx.db.get(folderId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  const updates: Partial<Doc<'folders'>> = {
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  }

  if (name !== undefined) {
    updates.name = name
    updates.slug = await validateSidebarItemRename(ctx, {
      item: folder,
      newName: name,
    })
  }

  await ctx.db.patch(folderId, updates)
  return { folderId: folder._id, slug: updates.slug ?? folder.slug }
}
