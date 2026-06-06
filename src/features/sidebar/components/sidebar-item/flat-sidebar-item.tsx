import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { EditableName } from './editable-item-name'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { useEditFileSystemItem } from '~/features/filesystem/useEditFileSystemItem'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import {
  useIsFocusedItem,
  useSidebarItemVisualState,
} from '~/features/sidebar/hooks/useSelectedItem'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import { isOptimisticSidebarItem } from '~/features/filesystem/optimistic-sidebar-items'
import { sidebarItemNameClass } from '~/features/sidebar/utils/sidebar-item-visual-state'
import type { MouseEvent } from 'react'

interface FlatSidebarItemProps {
  item: AnySidebarItem
  isExpanded: boolean
  renamingId: Id<'sidebarItems'> | null
  setRenamingId: (id: Id<'sidebarItems'> | null) => void
  visibleItemIds: Array<Id<'sidebarItems'>>
}

export function FlatSidebarItem({
  item,
  isExpanded,
  renamingId,
  setRenamingId,
  visibleItemIds,
}: FlatSidebarItemProps) {
  const { editItem } = useEditFileSystemItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const visualState = useSidebarItemVisualState(item)
  const isFocused = useIsFocusedItem(item)
  const { toggleExpanded } = useFolderState(item._id)
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: 'bookmarks',
    parentId: null,
    visibleItemIds,
  })

  const icon = getSidebarItemIcon(item)
  const isPending = isOptimisticSidebarItem(item)

  const selectBookmarkedItem = (event: MouseEvent) => {
    handleItemClick(event, () => setLastSelectedItem(item.slug))
  }

  const handleFinishRename = async (name: string) => {
    await editItem({ item, name })
    setRenamingId(null)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
  }

  return (
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
          nameContent={
            <EditableName
              initialName={item.name}
              isRenaming={renamingId === item._id}
              onFinishRename={handleFinishRename}
              onCancelRename={handleCancelRename}
              displayClassName={sidebarItemNameClass(visualState)}
              campaignId={item.campaignId}
              parentId={item.parentId}
              excludeId={item._id}
            />
          }
          presentation={{
            visualState,
            focused: isFocused,
            expanded: isExpanded,
            renaming: renamingId === item._id,
            showChevron: false,
            pending: isPending,
          }}
          linkProps={linkProps}
          onClick={selectBookmarkedItem}
          onContextMenu={handleItemContextMenu}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={(event) => {
            handleItemContextMenu(event)
            handleMoreOptions(event)
          }}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )
}
