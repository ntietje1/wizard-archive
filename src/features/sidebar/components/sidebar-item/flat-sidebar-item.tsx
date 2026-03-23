import { memo } from 'react'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useRenameItem } from '~/features/sidebar/hooks/useRenameItem'
import { useFolderState } from '~/features/sidebar/hooks/useFolderState'
import { useContextMenu } from '~/features/context-menu/hooks/useContextMenu'
import { useEditorLinkProps } from '~/features/sidebar/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/features/sidebar/hooks/useLastEditorItem'
import { useIsSelectedItem } from '~/features/sidebar/hooks/useSelectedItem'
import { getSidebarItemIcon } from '~/shared/utils/category-icons'
import { EditorContextMenu } from '~/features/context-menu/components/editor-context-menu'

interface FlatSidebarItemProps {
  item: AnySidebarItem
  isExpanded: boolean
  renamingId: SidebarItemId | null
  setRenamingId: (id: SidebarItemId | null) => void
}

function FlatSidebarItemComponent({
  item,
  isExpanded,
  renamingId,
  setRenamingId,
}: FlatSidebarItemProps) {
  const { rename } = useRenameItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const isSelected = useIsSelectedItem(item)
  const { toggleExpanded } = useFolderState(item._id)

  const icon = getSidebarItemIcon(item)

  const handleClick = () =>
    setLastSelectedItem({ type: item.type, slug: item.slug })

  const handleFinishRename = async (name: string) => {
    await rename(item, name)
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
          onToggleExpanded={toggleExpanded}
          onMoreOptions={handleMoreOptions}
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
