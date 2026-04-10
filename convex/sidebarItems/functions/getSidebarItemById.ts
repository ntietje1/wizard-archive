import { ERROR_CODE, throwClientError } from '../../errors'
import { SIDEBAR_ITEM_TYPES } from '../types/baseTypes'
import { requireCampaignMembership } from '../../functions'
import { PERMISSION_LEVEL } from '../../permissions/types'
import { checkItemAccess } from '../validation'
import { enhanceNoteWithContent } from '../../notes/functions/enhanceNote'
import { enhanceFolderWithContent } from '../../folders/functions/enhanceFolder'
import { enhanceGameMapWithContent } from '../../gameMaps/functions/enhanceMap'
import { enhanceFileWithContent } from '../../files/functions/enhanceFile'
import { enhanceCanvasWithContent } from '../../canvases/functions/enhanceCanvas'
import { loadSingleExtensionData } from './loadExtensionData'
import { assertNever } from '../../common/types'
import type { AnySidebarItemWithContent } from '../types/types'
import type { SidebarItemId } from '../types/baseTypes'
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
  const raw = await ctx.db.get('sidebarItems', id)
  if (!raw) return null

  const item = await loadSingleExtensionData(ctx, raw)

  await requireCampaignMembership(ctx, item.campaignId)

  const enhanced = await checkItemAccess(ctx, {
    rawItem: item,
    requiredLevel: PERMISSION_LEVEL.VIEW,
  })
  if (!enhanced) return null

  switch (enhanced.type) {
    case SIDEBAR_ITEM_TYPES.notes:
      return enhanceNoteWithContent(ctx, { note: enhanced })
    case SIDEBAR_ITEM_TYPES.folders:
      return enhanceFolderWithContent(ctx, { folder: enhanced })
    case SIDEBAR_ITEM_TYPES.gameMaps:
      return enhanceGameMapWithContent(ctx, { gameMap: enhanced })
    case SIDEBAR_ITEM_TYPES.files:
      return enhanceFileWithContent(ctx, { file: enhanced })
    case SIDEBAR_ITEM_TYPES.canvases:
      return enhanceCanvasWithContent(ctx, { canvas: enhanced })
    default:
      assertNever(enhanced)
  }
}
