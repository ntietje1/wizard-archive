import { ERROR_CODE, throwClientError } from '../../errors'
import {
  prepareSidebarItemRename,
  requireItemAccess,
} from '../../sidebarItems/validation/validation'
import { getSidebarItem } from '../../sidebarItems/functions/getSidebarItem'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { logEditHistory } from '../../editHistory/log'
import { EDIT_HISTORY_ACTION } from '../../editHistory/types'
import { SIDEBAR_ITEM_TYPES } from '../../sidebarItems/types/baseTypes'
import type { SidebarItemName } from '../../sidebarItems/validation/name'
import type { SidebarItemColor } from '../../sidebarItems/validation/color'
import type { SidebarItemIconName } from '../../sidebarItems/validation/icon'
import type { EditHistoryChange } from '../../editHistory/types'
import type { SidebarItemSlug } from '../../sidebarItems/validation/slug'
import type { WithoutSystemFields } from 'convex/server'
import type { CampaignMutationCtx } from '../../functions'
import type { Doc, Id } from '../../_generated/dataModel'

export async function updateFolder(
  ctx: CampaignMutationCtx,
  {
    folderId,
    name,
    iconName,
    color,
  }: {
    folderId: Id<'sidebarItems'>
    name?: SidebarItemName
    iconName?: SidebarItemIconName | null
    color?: SidebarItemColor | null
  },
): Promise<{ folderId: Id<'sidebarItems'>; slug: SidebarItemSlug }> {
  const rawItem = await getSidebarItem(ctx, folderId)
  if (!rawItem) throwClientError(ERROR_CODE.NOT_FOUND, 'Folder not found')
  const folder = await requireItemAccess(ctx, {
    rawItem,
    requiredLevel: PERMISSION_LEVEL.FULL_ACCESS,
  })

  let newSlug: SidebarItemSlug | undefined
  const updates: Partial<WithoutSystemFields<Doc<'sidebarItems'>>> = {}
  const changes: Array<EditHistoryChange> = []

  if (name !== undefined) {
    const rename = await prepareSidebarItemRename(ctx, {
      item: folder,
      newName: name,
    })
    if (rename) {
      updates.name = rename.name
      newSlug = rename.slug
      updates.slug = rename.slug
      changes.push({
        action: EDIT_HISTORY_ACTION.renamed,
        metadata: { from: folder.name, to: rename.name },
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

  await ctx.db.patch('sidebarItems', folderId, {
    ...updates,
    updatedTime: Date.now(),
    updatedBy: ctx.membership.userId,
  })

  await logEditHistory(ctx, {
    itemId: folder._id,
    itemType: SIDEBAR_ITEM_TYPES.folders,
    changes,
  })

  return { folderId: folder._id, slug: newSlug ?? folder.slug }
}
