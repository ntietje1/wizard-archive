import type { AnySidebarItem, SidebarItemId } from 'convex/sidebarItems/types'
import { useFileSidebar } from '~/contexts/FileSidebarContext'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useFolderState } from '~/hooks/useFolderState'
import { useSidebarItemsByParent } from '~/hooks/useSidebarItems'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useEditorNavigation } from '~/hooks/useEditorNavigation'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { defaultItemName } from 'convex/sidebarItems/sidebarItems'
import {
  Collapsible,
  CollapsibleContent,
} from '~/components/shadcn/ui/collapsible'
import { SidebarItem } from './sidebar-item'
import { SidebarItemContextMenu } from '~/components/context-menu/sidebar/SidebarItemContextMenu'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import { isTagCategory, isNote } from '~/lib/sidebar-item-utils'
import { useQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from 'convex/_generated/api'

interface SidebarItemButtonProps {
  item: AnySidebarItem
  ancestorIds?: SidebarItemId[]
}

function getItemDisplayName(item: AnySidebarItem): string {
  if (isTagCategory(item)) {
    return item.pluralName || item.name || 'Category'
  }
  return item.name || defaultItemName(item)
}

export function SidebarItemButton({
  item,
  ancestorIds = [],
}: SidebarItemButtonProps) {
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

  // If item is a category, use it directly; otherwise query the category
  const categoryQuery = useQuery(
    convexQuery(
      api.tags.queries.getTagCategory,
      !isTagCategory(item) && item.categoryId
        ? {
            campaignId: item.campaignId,
            categoryId: item.categoryId,
          }
        : 'skip',
    ),
  )

  const category = isTagCategory(item) ? item : categoryQuery.data

  const handleFinishRename = async (name: string) => {
    if (!rename) return
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
      isExpanded={hasChildren ? isExpanded : undefined}
      isRenaming={renamingId === item._id}
      onSelect={handleSelect}
      onToggleExpanded={toggleExpanded}
      onMoreOptions={handleMoreOptions}
      onFinishRename={handleFinishRename}
      showChevron={hasChildren}
    />
  )

  const wrappedButton = (
    <SidebarItemContextMenu
      ref={contextMenuRef}
      item={item}
      viewContext="sidebar"
      category={category}
    >
      {button}
    </SidebarItemContextMenu>
  )

  return (
    <DroppableSidebarItem item={item} ancestorIds={ancestorIds}>
      <DraggableSidebarItem item={item} ancestorIds={ancestorIds}>
        <Collapsible
          open={isExpanded}
          onOpenChange={toggleExpanded}
          className="w-full"
        >
          {wrappedButton}
          {hasChildren && (
            <CollapsibleContent>
              <div className={isNote(item) ? 'relative pl-4' : 'ml-4'}>
                {children.data?.map((childItem) => (
                  <SidebarItem
                    key={childItem._id}
                    item={childItem}
                    ancestorIds={currentAncestors}
                  />
                ))}
              </div>
            </CollapsibleContent>
          )}
        </Collapsible>
      </DraggableSidebarItem>
    </DroppableSidebarItem>
  )
}
