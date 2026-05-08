import { memo } from 'react'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
import { useEditSidebarItem } from '~/features/sidebar/hooks/useEditSidebarItem'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'
import { useItemSelectionInteractions } from '~/features/sidebar/hooks/useItemSelectionInteractions'
import type { MouseEvent } from 'react'

interface FlatSidebarItemProps {
  item: AnySidebarItem
  isExpanded: boolean
  renamingId: Id<'sidebarItems'> | null
  setRenamingId: (id: Id<'sidebarItems'> | null) => void
  visibleItemIds: Array<Id<'sidebarItems'>>
}

function FlatSidebarItemComponent({
  item,
  isExpanded,
  renamingId,
  setRenamingId,
  visibleItemIds,
}: FlatSidebarItemProps) {
  const { editItem } = useEditSidebarItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const isSelected = useIsSelectedItem(item)
  const { toggleExpanded } = useFolderState(item._id)
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface: 'bookmarks',
    parentId: null,
    visibleItemIds,
  })

  const icon = getSidebarItemIcon(item)

  const handleClick = (event: MouseEvent) => {
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
          onContextMenu={handleItemContextMenu}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={(event) => {
            handleItemContextMenu(event)
            handleMoreOptions(event)
          }}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          showChevron={false}
          campaignId={item.campaignId}
          parentId={item.parentId}
          excludeId={item._id}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )
}

export const FlatSidebarItem = memo(FlatSidebarItemComponent)
