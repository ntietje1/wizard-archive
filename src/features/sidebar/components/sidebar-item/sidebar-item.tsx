import { useEffect, useRef } from 'react'
import type { MouseEvent } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { SidebarShareButton } from './sidebar-item-share-button'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import {
  useIsFocusedItem,
  useSidebarItemVisualState,
} from '~/features/sidebar/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useEditFileSystemItem } from '~/features/filesystem/useEditFileSystemItem'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { Collapsible, CollapsibleContent } from '~/features/shadcn/components/collapsible'
import { sortItemsByOptions } from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { sidebarItemActionButtonClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

interface SidebarItemProps {
  item: AnySidebarItem
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  visibleItemIds: Array<Id<'sidebarItems'>>
  depth?: number
}

export function SidebarItem({ item, parentItemsMap, visibleItemIds, depth = 0 }: SidebarItemProps) {
  const { editItem } = useEditFileSystemItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const visualState = useSidebarItemVisualState(item)
  const isFocused = useIsFocusedItem(item)
  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const renamingId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { sortOptions } = useSortOptions()
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: 'sidebar',
    parentId: null,
    visibleItemIds,
  })

  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const icon = getSidebarItemIcon(item)
  const isPending = isOptimisticSidebarItem(item)
  const shouldScrollPendingItem = isPending && visibleItemIds.includes(item._id)
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shouldScrollPendingItem) return
    rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    rowRef.current?.focus()
  }, [shouldScrollPendingItem])

  const children = isFolder ? parentItemsMap.get(item._id) : undefined

  const sortedChildren = sortItemsByOptions(sortOptions, children) ?? []

  const selectSidebarItem = (event: MouseEvent) => {
    handleItemClick(event, () => setLastSelectedItem(item.slug))
  }

  const handleFinishRename = async (name: string) => {
    await editItem({ item, name })
    setRenamingId(null)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
  }

  const itemButton = (
    <DraggableSidebarItem item={item} disabled={isPending}>
      <EditorContextMenu
        ref={contextMenuRef}
        viewContext="sidebar"
        item={item}
        disabled={isPending}
      >
        <SidebarItemButtonBase
          icon={icon}
          name={item.name}
          presentation={{
            visualState,
            focused: isFocused,
            expanded: isExpanded,
            renaming: renamingId === item._id,
            showChevron: isFolder && !isPending,
            pending: isPending,
            indentLevel: depth,
          }}
          linkProps={linkProps}
          onClick={selectSidebarItem}
          onContextMenu={handleItemContextMenu}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={(event) => {
            handleItemContextMenu(event)
            handleMoreOptions(event)
          }}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          campaignId={item.campaignId}
          parentId={item.parentId}
          excludeId={item._id}
          shareButton={
            isPending ? null : (
              <SidebarShareButton
                item={item}
                buttonClassName={sidebarItemActionButtonClass(visualState)}
              />
            )
          }
          rowRef={rowRef}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )

  if (isFolder && !isPending) {
    return (
      <DroppableSidebarItem item={item}>
        <Collapsible open={isExpanded} onOpenChange={toggleExpanded}>
          {itemButton}
          <CollapsibleContent
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
                parentItemsMap={parentItemsMap}
                visibleItemIds={visibleItemIds}
                depth={depth + 1}
              />
            ))}
          </CollapsibleContent>
        </Collapsible>
      </DroppableSidebarItem>
    )
  }

  return itemButton
}
