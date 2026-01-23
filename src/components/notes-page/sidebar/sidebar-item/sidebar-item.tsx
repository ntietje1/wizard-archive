import { memo, useCallback, useMemo } from 'react'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useFolderState } from '~/hooks/useFolderState'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'
import { sortItemsByOptions } from '~/hooks/useSidebarItems'
import { useSortOptions } from '~/hooks/useSortOptions'

interface SidebarItemProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
  /** Map from parent ID to children - passed down to avoid re-fetching */
  parentItemsMap: Map<SidebarItemId | undefined, Array<AnySidebarItem>>
  className?: string
}

function SidebarItemComponent({
  item,
  ancestorIds = [],
  parentItemsMap,
  className,
}: SidebarItemProps) {
  const { rename } = useRenameItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { navigateToItem } = useEditorNavigation()
  const { item: currentItem } = useCurrentItem()
  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const { renamingId, setRenamingId, activeDragItem } = useFileSidebar()
  const { sortOptions } = useSortOptions()

  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const icon = getSidebarItemIcon(item)
  const defaultName = defaultItemName(item)
  const displayName = item.name || defaultName
  const isSelected = currentItem?._id === item._id
  const isDraggingActive = !!activeDragItem

  // Get children from the map
  const children = useMemo(
    () => parentItemsMap.get(item._id) ?? [],
    [parentItemsMap, item._id],
  )
  const sortedChildren = useMemo(
    () => sortItemsByOptions(sortOptions, children) ?? [],
    [sortOptions, children],
  )
  const hasChildren = sortedChildren.length > 0

  // Build ancestor IDs for children
  const currentAncestors = useMemo(
    () => [...ancestorIds, item._id],
    [ancestorIds, item._id],
  )

  const handleSelect = useCallback(
    () => navigateToItem(item),
    [navigateToItem, item],
  )

  const handleFinishRename = useCallback(
    async (name: string) => {
      if (!item) return
      await rename(item, name)
      setRenamingId(null)
    },
    [item, rename, setRenamingId],
  )

  const handleCancelRename = useCallback(() => {
    setRenamingId(null)
  }, [setRenamingId])

  const itemButton = (
    <DraggableSidebarItem item={item} ancestorIds={ancestorIds}>
      <EditorContextMenu ref={contextMenuRef} viewContext="sidebar" item={item}>
        <SidebarItemButtonBase
          icon={icon}
          name={displayName}
          defaultName={defaultName}
          isSelected={isSelected}
          isExpanded={isExpanded}
          isRenaming={renamingId === item._id}
          isDragging={activeDragItem?._id === item._id}
          isDraggingActive={isDraggingActive}
          onSelect={handleSelect}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={handleMoreOptions}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          showChevron={isFolder}
          campaignId={item.campaignId}
          parentId={item.parentId}
          excludeId={item._id}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )

  if (isFolder) {
    return (
      <DroppableSidebarItem item={item} ancestorIds={ancestorIds}>
        <Collapsible open={isExpanded} onOpenChange={toggleExpanded}>
          {itemButton}
          <CollapsibleContent
            className="pl-4"
            transition={{ duration: 0.2, ease: 'circInOut' }}
            keepRendered
          >
            {sortedChildren.map((childItem) => (
              <SidebarItem
                key={childItem._id}
                item={childItem}
                ancestorIds={currentAncestors}
                parentItemsMap={parentItemsMap}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </DroppableSidebarItem>
    )
  }

  return itemButton
}

export const SidebarItem = memo(SidebarItemComponent)
