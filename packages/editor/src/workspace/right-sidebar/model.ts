import { RESOURCE_TYPES } from '../items-persistence-contract'
import type { ResourceKind } from '../resource-contract'
import { RIGHT_SIDEBAR_CONTENT } from './content'
import type { RightSidebarContentId } from './content'

const RIGHT_SIDEBAR_CONTENT_ITEM_TYPES: Record<
  RightSidebarContentId,
  ReadonlyArray<ResourceKind>
> = {
  [RIGHT_SIDEBAR_CONTENT.history]: [
    RESOURCE_TYPES.notes,
    RESOURCE_TYPES.folders,
    RESOURCE_TYPES.gameMaps,
    RESOURCE_TYPES.files,
    RESOURCE_TYPES.canvases,
  ],
  [RIGHT_SIDEBAR_CONTENT.backlinks]: [RESOURCE_TYPES.notes],
  [RIGHT_SIDEBAR_CONTENT.outgoing]: [RESOURCE_TYPES.notes],
  [RIGHT_SIDEBAR_CONTENT.outline]: [RESOURCE_TYPES.notes],
}

const RIGHT_SIDEBAR_CONTENT_PRIORITY = [
  RIGHT_SIDEBAR_CONTENT.history,
  RIGHT_SIDEBAR_CONTENT.backlinks,
  RIGHT_SIDEBAR_CONTENT.outgoing,
  RIGHT_SIDEBAR_CONTENT.outline,
] as const satisfies ReadonlyArray<RightSidebarContentId>

export function getRightSidebarContentItemTypes(contentId: RightSidebarContentId) {
  return RIGHT_SIDEBAR_CONTENT_ITEM_TYPES[contentId]
}

export function canShowRightSidebarContent(
  itemType: ResourceKind | null | undefined,
  contentId: RightSidebarContentId,
) {
  return itemType ? RIGHT_SIDEBAR_CONTENT_ITEM_TYPES[contentId].includes(itemType) : false
}

export function getDefaultRightSidebarContent(itemType: ResourceKind | null | undefined) {
  if (!itemType) return RIGHT_SIDEBAR_CONTENT.history
  return (
    RIGHT_SIDEBAR_CONTENT_PRIORITY.find((contentId) =>
      canShowRightSidebarContent(itemType, contentId),
    ) ?? RIGHT_SIDEBAR_CONTENT.history
  )
}
