import { useEffect, useRef } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'shared/sidebar-items/types'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import { SidebarLiveItemButton } from './sidebar-live-item-button'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { sortItemsByOptions } from '~/features/sidebar/utils/sidebar-item-sort'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'
import { SidebarTreeNodeShell } from '~/features/sidebar/components/sidebar-tree-surface'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'

interface SidebarItemProps {
  item: AnySidebarItem
  parentItemsMap: Map<Id<'sidebarItems'> | null, Array<AnySidebarItem>>
  visibleItemIds: Array<Id<'sidebarItems'>>
  depth?: number
}

export function SidebarItem({ item, parentItemsMap, visibleItemIds, depth = 0 }: SidebarItemProps) {
  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const renamingId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { sortOptions } = useSortOptions()

  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const isPending = isOptimisticSidebarItem(item)
  const children = isFolder && isExpanded ? parentItemsMap.get(item._id) : undefined
  const shouldScrollPendingItem = isPending && visibleItemIds.includes(item._id)
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shouldScrollPendingItem) return
    rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    rowRef.current?.focus()
  }, [shouldScrollPendingItem])

  const sortedChildren = sortItemsByOptions(sortOptions, children) ?? []

  const itemButton = (
    <SidebarLiveItemButton
      expanded={isExpanded}
      indentLevel={depth}
      item={item}
      onToggleExpanded={toggleExpanded}
      renamingId={renamingId}
      rowRef={rowRef}
      setRenamingId={setRenamingId}
      showChevron={isFolder && !isPending}
      showShareButton
      surface="sidebar"
      visibleItemIds={visibleItemIds}
    />
  )

  if (isFolder && !isPending) {
    return (
      <DroppableSidebarItem item={item}>
        <SidebarTreeNodeShell
          expanded={isExpanded}
          itemButton={itemButton}
          onExpandedChange={toggleExpanded}
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
        </SidebarTreeNodeShell>
      </DroppableSidebarItem>
    )
  }

  return itemButton
}
