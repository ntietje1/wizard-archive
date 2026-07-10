import { getSidebarItemAncestors } from '../../folders/functions/getSidebarItemAncestors'
import { enhanceBase } from '../../sidebarItems/functions/enhanceBaseSidebarItem'
import type { CampaignQueryCtx } from '../../functions'
import type {
  CanvasItem,
  CanvasItemRow,
  CanvasItemWithContent,
} from '@wizard-archive/editor/canvas/item-contract'
import type { SidebarItemEnhancement } from '../../sidebarItems/functions/enhanceBaseSidebarItem'

export const enhanceCanvas = (
  ctx: CampaignQueryCtx,
  { canvas, enhancement }: { canvas: CanvasItemRow; enhancement?: SidebarItemEnhancement },
): Promise<CanvasItem> => {
  return enhanceBase(ctx, { item: canvas, enhancement })
}

export const enhanceCanvasWithContent = async (
  ctx: CampaignQueryCtx,
  { canvas }: { canvas: CanvasItem },
): Promise<CanvasItemWithContent> => {
  const ancestors = await getSidebarItemAncestors(ctx, {
    initialParentId: canvas.parentId,
    isTrashed: canvas.isTrashed,
  })

  return {
    ...canvas,
    ancestors,
  }
}
