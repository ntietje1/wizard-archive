import { memo } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { SidebarShareButton } from './sidebar-item-share-button'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/features/sidebar/stores/sidebar-ui-store'
import { useRenameSidebarItem } from '~/features/sidebar/hooks/useRenameSidebarItem'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import {
  Collapsible,
  CollapsibleContent,
} from '~/features/shadcn/components/collapsible'
import { sortItemsByOptions } from '~/features/sidebar/hooks/useSidebarItems'
import { useSortOptions } from '~/features/sidebar/hooks/useSortOptions'

interface SidebarItemProps {
  item: AnySidebarItem
  parentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>
}

function SidebarItemComponent({ item, parentItemsMap }: SidebarItemProps) {
  const { rename } = useRenameSidebarItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const isSelected = useIsSelectedItem(item)
  const { isExpanded, toggleExpanded } = useFolderState(item._id)
  const renamingId = useSidebarUIStore((s) => s.renamingId)
  const setRenamingId = useSidebarUIStore((s) => s.setRenamingId)
  const { sortOptions } = useSortOptions()

  const isFolder = item.type === SIDEBAR_ITEM_TYPES.folders
  const icon = getSidebarItemIcon(item)

  const children = isFolder ? parentItemsMap.get(item._id) : undefined

  const sortedChildren = sortItemsByOptions(sortOptions, children) ?? []

  const handleClick = () =>
    setLastSelectedItem({ type: item.type, slug: item.slug })

  const handleFinishRename = async (name: string) => {
    await rename(item, name)
    setRenamingId(null)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
  }

  const itemButton = (
    <DraggableSidebarItem item={item}>
      <EditorContextMenu ref={contextMenuRef} viewContext="sidebar" item={item}>
        <SidebarItemButtonBase
          icon={icon}
          name={item.name}
          isSelected={isSelected}
          isExpanded={isExpanded}
          isRenaming={renamingId === item._id}
          linkProps={linkProps}
          onClick={handleClick}
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
      <DroppableSidebarItem item={item}>
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
