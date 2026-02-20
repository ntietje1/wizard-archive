import { memo, useCallback, useMemo } from 'react'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/baseTypes'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { SidebarShareButton } from './sidebar-item-share-button'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderState } from '~/hooks/useFolderState'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useIsSelectedItem } from '~/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
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
  ancestorIds?: Array<Id<'folders'>>
  parentItemsMap: Map<Id<'folders'> | undefined, Array<AnySidebarItem>>
}

function SidebarItemComponent({
  item,
  ancestorIds = [],
  parentItemsMap,
}: SidebarItemProps) {
  const { rename } = useRenameItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { navigateToItem } = useEditorNavigationContext()
  const isSelected = useIsSelectedItem(item)
  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const renamingId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { sortOptions } = useSortOptions()

  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const icon = getSidebarItemIcon(item)
  const defaultName = defaultItemName(item)
  const displayName = item.name || defaultName

  const children = isFolder ? parentItemsMap.get(item._id) : undefined

  const sortedChildren = useMemo(() => {
    return sortItemsByOptions(sortOptions, children) ?? []
  }, [sortOptions, children])

  // Build ancestor IDs for children
  const currentAncestors = useMemo(() => {
    if (!isFolder) return undefined
    return [...ancestorIds, item._id]
  }, [ancestorIds, item._id, isFolder])

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
          onSelect={handleSelect}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={handleMoreOptions}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          showChevron={isFolder}
          campaignId={item.campaignId}
          parentId={item.parentId}
          excludeId={item._id}
          shareButton={<SidebarShareButton item={item} />}
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
            transition={{
              duration: isExpanded ? 0.2 : 0.15,
              ease: 'easeInOut',
            }}
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
