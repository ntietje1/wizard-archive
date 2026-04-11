import { SIDEBAR_ITEM_LOCATION } from '../../sidebarItems/types/baseTypes'
import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type { Canvas, CanvasFromDb, CanvasWithContent } from '../types'

export const enhanceCanvas = (
  ctx: CampaignQueryCtx,
  { canvas }: { canvas: CanvasFromDb },
): Promise<Canvas> => {
  return enhanceBase(ctx, { item: canvas })
}

export const enhanceCanvasWithContent = async (
  ctx: CampaignQueryCtx,
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
