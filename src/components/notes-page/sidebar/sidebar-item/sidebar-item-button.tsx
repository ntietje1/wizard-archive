import { memo, useMemo } from 'react'
import {
  canItemHaveChildren,
  defaultItemName,
} from 'convex/sidebarItems/sidebarItems'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { SidebarItem } from './sidebar-item'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useFileSidebar } from '~/hooks/useFileSidebar'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useFolderState } from '~/hooks/useFolderState'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { SidebarContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'

interface SidebarItemButtonProps {
  item: AnySidebarItem
  ancestorIds?: Array<SidebarItemId>
}

function getItemDisplayName(item: AnySidebarItem): string {
  return item.name || defaultItemName(item)
}

const SidebarItemButtonComponent = ({
  item,
  ancestorIds = [],
}: SidebarItemButtonProps) => {
  const { renamingId, setRenamingId } = useFileSidebar()
  const { rename } = useRenameItem(item)
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const { navigateToItem } = useEditorNavigation()
  const { item: currentItem } = useCurrentItem()

  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const children = useSidebarItemsByParent(item._id)
  const hasChildren = (children.data && children.data.length > 0) || false
  const currentAncestors: Array<SidebarItemId> = [...ancestorIds, item._id]

  const icon = getSidebarItemIcon(item)
  const defaultName = defaultItemName(item)
  const displayName = getItemDisplayName(item)
  const isSelected = currentItem?._id === item._id
  const handleSelect = () => navigateToItem(item)

  const handleFinishRename = async (name: string) => {
    try {
      await rename(name)
      setRenamingId(null)
    } catch (error) {
      console.error(error)
      setRenamingId(null)
    }
  }

  const button = (
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
      showChevron={canItemHaveChildren(item.type)}
    />
  )

  const wrappedButton = (
    <SidebarContextMenu ref={contextMenuRef} item={item}>
      {button}
    </SidebarContextMenu>
  )

  return (
    <DroppableSidebarItem item={item} ancestorIds={ancestorIds}>
      <DraggableSidebarItem item={item} ancestorIds={ancestorIds}>
        <Collapsible
          open={isExpanded}
          onOpenChange={toggleExpanded}
          className="w-full"
          disabled={!canItemHaveChildren(item.type)}
        >
          {wrappedButton}
          {canItemHaveChildren(item.type) && (
            <CollapsibleContent
              transition={{ duration: 0.1, ease: 'easeInOut' }}
              keepRendered
            >
              {hasChildren && (
                <div className="ml-4">
                  {children.data?.map((childItem) => (
                    <SidebarItem
                      key={childItem._id}
                      item={childItem}
                      ancestorIds={currentAncestors}
                    />
                  ))}
                </div>
              )}
            </CollapsibleContent>
          )}
        </Collapsible>
      </DraggableSidebarItem>
    </DroppableSidebarItem>
  )
}

export const SidebarItemButton = memo(SidebarItemButtonComponent)
