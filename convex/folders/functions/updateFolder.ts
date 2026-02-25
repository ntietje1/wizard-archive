import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../shares/types'
import type { WithoutSystemFields } from 'convex/server'
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

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'folders'>>> = {}

  if (name !== undefined) {
    updates.name = name
    newSlug = await validateSidebarItemRename(ctx, {
      item: folder,
      newName: name,
    })
    updates.slug = newSlug
  }

  if (Object.keys(updates).length === 0) {
    return { folderId: folder._id, slug: folder.slug }
  }

  await ctx.db.patch(folderId, {
    ...updates,
    _updatedTime: Date.now(),
    _updatedBy: ctx.user.profile._id,
  })
  return { folderId: folder._id, slug: newSlug ?? folder.slug }
}
