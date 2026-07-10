import { useEffect, useRef } from 'react'
import { Collapsible, CollapsibleContent } from '@wizard-archive/ui/shadcn/components/collapsible'
import { RESOURCE_TYPES } from '../../../items-persistence-contract'
import { isOptimisticSidebarItem } from '../../../items/optimistic'
import type { AnyItem } from '../../../items'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import { SidebarItemButton } from './sidebar-item-button'
import type { SidebarItemId } from '../../../../../../../shared/common/ids'
import { useFolderState } from '../../hooks/use-folder-state'
import { useSidebarWorkspaceState } from '../../workspace-state'
import type { SidebarItemSource } from '../sidebar-tree-source'

interface SidebarItemProps {
  getChildren: (parentId: SidebarItemId) => ReadonlyArray<AnyItem>
  item: AnyItem
  source: SidebarItemSource
  visibleItemIds: ReadonlyArray<SidebarItemId>
  depth?: number
}

export function SidebarItem({
  getChildren,
  item,
  source,
  visibleItemIds,
  depth = 0,
}: SidebarItemProps) {
  const { isExpanded, toggleExpanded } = useFolderState(item.id)
  const {
    editing: { renamingItemId, setRenamingItemId },
  } = useSidebarWorkspaceState()

  const isFolderItem = item.type === RESOURCE_TYPES.folders
  const isPending = isOptimisticSidebarItem(item)
  const childItems = isFolderItem && isExpanded ? getChildren(item.id) : []
  const shouldScrollPendingItem = isPending && visibleItemIds.includes(item.id)
  const rowRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shouldScrollPendingItem) return
    rowRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [shouldScrollPendingItem])

  const itemButton = (
    <SidebarItemButton
      expanded={isExpanded}
      indentLevel={depth}
      item={item}
      onToggleExpanded={toggleExpanded}
      renamingId={renamingItemId}
      rowRef={rowRef}
      setRenamingId={setRenamingItemId}
      showChevron={isFolderItem && !isPending}
      showShareButton
      source={source}
      surface="sidebar"
      visibleItemIds={visibleItemIds}
    />
  )

  if (isFolderItem && !isPending) {
    return (
      <DroppableSidebarItem item={item} canDrop={source.canDropOnFolder(item)}>
        <Collapsible open={isExpanded} onOpenChange={toggleExpanded}>
          {itemButton}
          <CollapsibleContent
            transition={{
              duration: isExpanded ? 0.2 : 0.15,
              ease: 'easeInOut',
            }}
            keepRendered={false}
          >
            {childItems.map((childItem) => (
              <SidebarItem
                key={childItem.id}
                getChildren={getChildren}
                item={childItem}
                source={source}
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
