import { RESOURCE_TYPES } from '../../workspace/items-persistence-contract'
import type { AnyItem, AnyItemWithContent } from '../../workspace/items'
export function isCanvasSidebarItemEmbedRichTextEditable(
  item: AnyItem | AnyItemWithContent | null | undefined,
) {
  return item?.type === RESOURCE_TYPES.notes
}

function isSidebarItemType(
  item: AnyItemWithContent | undefined,
  types: ReadonlySet<AnyItemWithContent['type']>,
) {
  return item ? types.has(item.type) : false
}

const FREEFORM_RESIZE_TYPES = new Set<AnyItemWithContent['type']>([
  RESOURCE_TYPES.notes,
  RESOURCE_TYPES.canvases,
])

export function shouldCanvasSidebarItemEmbedUseFreeformResize(
  item: AnyItemWithContent | undefined,
) {
  return isSidebarItemType(item, FREEFORM_RESIZE_TYPES)
}

export function shouldClearDefaultCanvasSidebarItemEmbedAspectRatio(
  item: AnyItemWithContent | undefined,
) {
  return isSidebarItemType(item, FREEFORM_RESIZE_TYPES)
}

export function shouldCanvasSidebarItemEmbedUseDocumentShapeDefault(
  item: AnyItemWithContent | undefined,
) {
  return item?.type === RESOURCE_TYPES.notes
}

export function shouldCanvasSidebarItemEmbedLockToMediaAspectRatio(
  item: AnyItemWithContent | undefined,
) {
  return item?.type === RESOURCE_TYPES.files || item?.type === RESOURCE_TYPES.gameMaps
}
