import { ERROR_CODE, throwClientError, throwServerError } from '../../errors'
import { getNote } from '../../notes/functions/getNote'
import { getMap } from '../../gameMaps/functions/getMap'
import { getFolder } from '../../folders/functions/getFolder'
import { getFile } from '../../files/functions/getFile'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { requireCampaignMembership } from '../../functions'
import type { AnySidebarItemWithContent } from '../types/types'
import type { SidebarItemId } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { AuthQueryCtx } from '../../functions'

export const requireSidebarItemById = async (
  ctx: AuthQueryCtx,
  { id }: { id: SidebarItemId },
): Promise<AnySidebarItemWithContent> => {
  const result = await getSidebarItemById(ctx, { id })
  if (!result) {
    throwClientError(ERROR_CODE.NOT_FOUND, 'This item could not be found')
  }
  return result
}

export const getSidebarItemById = async (
  ctx: AuthQueryCtx,
  { id }: { id: SidebarItemId },
): Promise<AnySidebarItemWithContent | null> => {
  const item = await ctx.db.get(id)
  if (!item) {
    return null
  }

  await requireCampaignMembership(ctx, item.campaignId)

  let result: AnySidebarItemWithContent | null = null

  switch (item.type) {
    case SIDEBAR_ITEM_TYPES.folders:
      result = await getFolder(ctx, { folderId: id as Id<'folders'> })
      break
    case SIDEBAR_ITEM_TYPES.notes:
      result = await getNote(ctx, { noteId: id as Id<'notes'> })
      break
    case SIDEBAR_ITEM_TYPES.gameMaps:
      result = await getMap(ctx, { mapId: id as Id<'gameMaps'> })
      break
    case SIDEBAR_ITEM_TYPES.files:
      result = await getFile(ctx, { fileId: id as Id<'files'> })
      break
    default:
      throwServerError('Unknown item type')
  }

  return result
}
