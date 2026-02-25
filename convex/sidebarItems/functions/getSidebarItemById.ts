import { getNote } from '../../notes/functions/getNote'
import { getMap } from '../../gameMaps/functions/getMap'
import { getFolder } from '../../folders/functions/getFolder'
import { getFile } from '../../files/functions/getFile'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import type { AnySidebarItemWithContent } from '../types/types'
import type { SidebarItemId } from '../types/baseTypes'
import type { Id } from '../../_generated/dataModel'
import type { CampaignQueryCtx } from '../../functions'

export const getSidebarItemById = async (
  ctx: CampaignQueryCtx,
  { id }: { id: SidebarItemId },
): Promise<AnySidebarItemWithContent | null> => {
  const campaignId = ctx.campaign._id

  const item = await ctx.db.get(id)
  if (!item || item.campaignId !== campaignId) {
    return null
  }

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
      throw new Error(`Unknown item type`)
  }

  return result
}
