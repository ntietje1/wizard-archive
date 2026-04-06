import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import type { SharesMap } from '../../sidebarShares/functions/getCampaignShares'
import type { AuthQueryCtx } from '../../functions'
import type { SidebarItemId } from '../../sidebarItems/types/baseTypes'
import type { Canvas, CanvasFromDb, CanvasWithContent } from '../types'

export const enhanceCanvas = (
  ctx: AuthQueryCtx,
  {
    canvas,
    sharesMap,
    bookmarkIds,
  }: {
    canvas: CanvasFromDb
    sharesMap?: SharesMap
    bookmarkIds?: Set<SidebarItemId>
  },
): Promise<Canvas> => {
  return enhanceBase(ctx, { item: canvas, sharesMap, bookmarkIds })
}

export const enhanceCanvasWithContent = async (
  ctx: AuthQueryCtx,
  { canvas }: { canvas: Canvas },
): Promise<CanvasWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: canvas.parentId,
    isTrashed: canvas.location === SIDEBAR_ITEM_LOCATION.trash,
  })

  return {
    ...canvas,
    ancestors,
  }
}
