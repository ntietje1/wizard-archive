import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
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
    isTrashed: canvas.isTrashed,
  })

  return {
    ...canvas,
    ancestors,
  }
}
