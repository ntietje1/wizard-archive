import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { AuthMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateFolder(
  ctx: AuthMutationCtx,
  {
    folderId,
    name,
    iconName,
    color,
  }: {
    folderId: Id<'folders'>
    name?: string
    iconName?: string | null
    color?: string | null
  },
): Promise<{ folderId: Id<'folders'>; slug: string }> {
  const folderFromDb = await ctx.db.get(folderId)
  if (!folderFromDb) throw new Error('Folder not found')
  await requireCampaignMembership(ctx, folderFromDb.campaignId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'folders'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item: folder,
      newName: trimmedName,
    })
    updates.slug = newSlug
  }

  if (iconName !== undefined) {
    updates.iconName = iconName
  }

  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    return { folderId: folder._id, slug: folder.slug }
  }

  await ctx.db.patch(folderId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })
  return { folderId: folder._id, slug: newSlug ?? folder.slug }
}
