import { ERROR_CODE, throwClientError } from '../../errors'
import {
  requireItemAccess,
  validateSidebarItemRename,
} from '../../sidebarItems/validation'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { requireCampaignMembership } from '../../functions'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { EditHistoryChange } from '../../editHistory/types'
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
  if (!folderFromDb) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  await requireCampaignMembership(ctx, folderFromDb.campaignId)
  const folder = await requireItemAccess(ctx, {
    rawItem: folderFromDb,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: string | undefined
  const updates: Partial<WithoutSystemFields<Doc<'folders'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const trimmedName = name.trim()
    if (trimmedName !== folder.name) {
      updates.name = trimmedName
      newSlug = await validateSidebarItemRename(ctx, {
        item: folder,
        newName: trimmedName,
      })
      updates.slug = newSlug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: folder.name, to: trimmedName },
      })
    }
  }

  if (iconName !== undefined && iconName !== folder.iconName) {
    updates.iconName = iconName
    changes.push({
      action: EDIT_HISTORY_ACTION.icon_changed,
      metadata: { from: folder.iconName, to: iconName },
    })
  }

  if (color !== undefined && color !== folder.color) {
    updates.color = color
    changes.push({
      action: EDIT_HISTORY_ACTION.color_changed,
      metadata: { from: folder.color, to: color },
    })
  }

  if (changes.length === 0) {
    return { folderId: folder._id, slug: folder.slug }
  }

  await ctx.db.patch(folderId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.user.profile._id,
  })

  await logEditHistory(ctx, {
    itemId: folder._id,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    campaignId: folder.campaignId,
    changes,
  })

  return { folderId: folder._id, slug: newSlug ?? folder.slug }
}
