import { ERROR_CODE, throwClientError } from '../../errors'
import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import type { WithoutSystemFields } from 'convex/server'
import type { AuthMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateFile(
  ctx: AuthMutationCtx,
  {
    fileId,
    name,
    storageId,
    iconName,
    color,
  }: {
    fileId: Id<'files'>
    name?: string
    storageId?: Id<'_storage'> | null
    iconName?: string | null
    color?: string | null
  },
): Promise<{ fileId: Id<'files'>; slug: string }> {
  const fileFromDb = await ctx.db.get(fileId)
  if (!fileFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'File not found')
  await requireCampaignMembership(ctx, fileFromDb.campaignId)
  const file = await requireItemAccess(ctx, {
    rawItem: fileFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'files'>>> = {}

  if (name !== undefined) {
    const trimmedName = name.trim()
    updates.name = trimmedName
    newSlug = await validateSidebarItemRename(ctx, {
      item: file,
      newName: trimmedName,
    })
    updates.slug = newSlug
  }
  if (storageId !== undefined) {
    updates.storageId = storageId
    if (storageId) {
      const metadata = await ctx.db.system.get(storageId)
      if (metadata?.contentType?.startsWith('image/')) {
        updates.previewStorageId = storageId
        updates.previewUpdatedAt = Date.now()
      }
    } else {
      updates.previewStorageId = null
    }
  }
  if (iconName !== undefined) {
    updates.iconName = iconName
  }
  if (color !== undefined) {
    updates.color = color
  }

  if (Object.keys(updates).length === 0) {
    return { fileId: file._id, slug: file.slug }
  }

  await ctx.db.patch(fileId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })
  return { fileId: file._id, slug: newSlug ?? file.slug }
}
