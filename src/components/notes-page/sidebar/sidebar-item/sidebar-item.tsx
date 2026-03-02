import { memo, useCallback, useMemo } from 'react'
import { SIDEBAR_ITEM_TYPES } from 'convex/sidebarItems/types/baseTypes'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { SidebarShareButton } from './sidebar-item-share-button'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { DroppableSidebarItem } from './droppable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useFolderState } from '~/hooks/useFolderState'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useIsSelectedItem } from '~/hooks/useSelectedItem'
import { useSidebarUIStore } from '~/stores/sidebarUIStore'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
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
  parentItemsMap: Map<Id<'folders'> | null, Array<AnySidebarItem>>
}

function SidebarItemComponent({
  item,
  parentItemsMap,
}: SidebarItemProps) {
  const { rename } = useRenameItem()
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

  const sortedChildren = useMemo(() => {
    return sortItemsByOptions(sortOptions, children) ?? []
  }, [sortOptions, children])

  const handleClick = useCallback(
    () => setLastSelectedItem({ type: item.type, slug: item.slug }),
    [setLastSelectedItem, item.type, item.slug],
  )

  const handleFinishRename = useCallback(
    async (name: string) => {
      await rename(item, name)
      setRenamingId(null)
    },
    [item, rename, setRenamingId],
  )

  const handleCancelRename = useCallback(() => {
    setRenamingId(null)
  }, [setRenamingId])

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
