import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { RIGHT_SIDEBAR_CONTENT } from '~/features/editor/chrome/right-sidebar-content'
import type { RightSidebarContentId } from '~/features/editor/chrome/right-sidebar-content'

export type RightSidebarItemType = (typeof SIDEBAR_ITEM_TYPES)[keyof typeof SIDEBAR_ITEM_TYPES]

const RIGHT_SIDEBAR_CONTENT_ITEM_TYPES: Record<
  RightSidebarContentId,
  ReadonlyArray<RightSidebarItemType>
> = {
  [RIGHT_SIDEBAR_CONTENT.history]: [
    SIDEBAR_ITEM_TYPES.notes,
    SIDEBAR_ITEM_TYPES.folders,
    SIDEBAR_ITEM_TYPES.gameMaps,
    SIDEBAR_ITEM_TYPES.files,
    SIDEBAR_ITEM_TYPES.canvases,
  ],
  [RIGHT_SIDEBAR_CONTENT.backlinks]: [SIDEBAR_ITEM_TYPES.notes],
  [RIGHT_SIDEBAR_CONTENT.outgoing]: [SIDEBAR_ITEM_TYPES.notes],
  [RIGHT_SIDEBAR_CONTENT.outline]: [SIDEBAR_ITEM_TYPES.notes],
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
  itemType: RightSidebarItemType | null | undefined,
  contentId: RightSidebarContentId,
) {
  return itemType ? RIGHT_SIDEBAR_CONTENT_ITEM_TYPES[contentId].includes(itemType) : false
}

export function getDefaultRightSidebarContent(itemType: RightSidebarItemType | null | undefined) {
  if (!itemType) return RIGHT_SIDEBAR_CONTENT.history
  return (
    RIGHT_SIDEBAR_CONTENT_PRIORITY.find((contentId) =>
      canShowRightSidebarContent(itemType, contentId),
    ) ?? RIGHT_SIDEBAR_CONTENT.history
  )
}

export function resolveRightSidebarContent(
  itemType: RightSidebarItemType | null | undefined,
  contentId: RightSidebarContentId | null | undefined,
) {
  if (contentId && canShowRightSidebarContent(itemType, contentId)) return contentId
  return getDefaultRightSidebarContent(itemType)
}
