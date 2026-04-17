import { ERROR_CODE, throwClientError } from '../../errors'
import {
  prepareSidebarItemRename,
  requireItemAccess,
} from '../../sidebarItems/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { EditHistoryChange } from '../../editHistory/types'
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
    fileId: Id<'sidebarItems'>
    name?: string
    storageId?: Id<'_storage'> | null
    iconName?: string | null
    color?: string | null
  },
): Promise<{ fileId: Id<'sidebarItems'>; slug: string }> {
  const rawItem = await getSidebarItem(ctx, fileId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'File not found')
  const file = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, {
      item: file,
      newName: name,
    })
    if (rename) {
      updates.name = rename.name
      newSlug = rename.slug
      updates.slug = rename.slug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: file.name, to: rename.name },
      })
    }
  }
  if (storageId !== undefined) {
    const ext = await ctx.db
      .query('files')
      .withIndex('by_sidebarItemId', (q) => q.eq('sidebarItemId', fileId))
      .unique()
    if (ext) {
      await ctx.db.patch('files', ext._id, { storageId })
    }
    if (storageId) {
      const metadata = await ctx.db.system.get('_storage', storageId)
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

  await ctx.db.patch('sidebarItems', fileId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: file._id,
    itemType: SIDEBAR_ITEM_TYPES.files,
    changes,
  })

  return { fileId: file._id, slug: newSlug ?? file.slug }
}
