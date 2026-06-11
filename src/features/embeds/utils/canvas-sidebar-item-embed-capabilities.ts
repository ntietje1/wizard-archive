import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import type { AnySidebarItemWithContent } from 'shared/sidebar-items/model-types'

export function isCanvasSidebarItemEmbedRichTextEditable(
  item: AnySidebarItemWithContent | undefined,
) {
  return item?.type === SIDEBAR_ITEM_TYPES.notes
}

function isNotesOrCanvasItem(item: AnySidebarItemWithContent | undefined) {
  return item?.type === SIDEBAR_ITEM_TYPES.notes || item?.type === SIDEBAR_ITEM_TYPES.canvases
}

export function shouldCanvasSidebarItemEmbedUseFreeformResize(
  item: AnySidebarItemWithContent | undefined,
) {
  return isNotesOrCanvasItem(item)
}

export function shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(
  item: AnySidebarItemWithContent | undefined,
) {
  return isNotesOrCanvasItem(item)
}

export function shouldCanvasSidebarItemEmbedUseDocumentShapeDefault(
  item: AnySidebarItemWithContent | undefined,
) {
  return item?.type === SIDEBAR_ITEM_TYPES.notes
}

export function shouldCanvasSidebarItemEmbedLockToMediaAspectRatio(
  item: AnySidebarItemWithContent | undefined,
) {
  return item?.type === SIDEBAR_ITEM_TYPES.files || item?.type === SIDEBAR_ITEM_TYPES.gameMaps
}
