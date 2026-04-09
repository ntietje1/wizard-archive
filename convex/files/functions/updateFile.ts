import { ERROR_CODE, throwClientError } from '../../errors'
import { requireItemAccess, validateSidebarItemRename } from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { EditHistoryChange } from '../../editHistory/types'
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
  const fileFromDb = await ctx.db.get("files", fileId)
  if (!fileFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'File not found')
  await requireCampaignMembership(ctx, fileFromDb.campaignId)
  const file = await requireItemAccess(ctx, {
    rawItem: fileFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'files'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const trimmedName = name.trim()
    if (trimmedName !== file.name) {
      updates.name = trimmedName
      newSlug = await validateSidebarItemRename(ctx, {
        item: file,
        newName: trimmedName,
      })
      updates.slug = newSlug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: file.name, to: trimmedName },
      })
    }
  }
  if (storageId !== undefined) {
    updates.storageId = storageId
    if (storageId) {
      const metadata = await ctx.db.system.get("_storage", storageId)
      if (metadata?.contentType?.startsWith('image/')) {
        updates.previewStorageId = storageId
        updates.previewUpdatedAt = Date.now()
      } else {
        updates.previewStorageId = null
        updates.previewUpdatedAt = null
      }
      changes.push({
        action: EDIT_HISTORY_ACTION.file_replaced,
        metadata: null,
      })
    } else {
      updates.previewStorageId = null
      updates.previewUpdatedAt = null
      changes.push({
        action: EDIT_HISTORY_ACTION.file_removed,
        metadata: null,
      })
    }
  }
  if (iconName !== undefined && iconName !== file.iconName) {
    updates.iconName = iconName
    changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: file.iconName, to: iconName },
    })
  }
  if (color !== undefined && color !== file.color) {
    updates.color = color
    changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: file.color, to: color },
    })
  }

  if (changes.length === 0) {
    return { fileId: file._id, slug: file.slug }
  }

  await ctx.db.patch("files", fileId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  await logEditHistory(ctx, {
    itemId: file._id,
    itemType: SIDEBAR_ITEM_TYPES.files,
    campaignId: file.campaignId,
    changes,
  })

  return { fileId: file._id, slug: newSlug ?? file.slug }
}
