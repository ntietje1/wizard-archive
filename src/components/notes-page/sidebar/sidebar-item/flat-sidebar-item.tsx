import { memo, useCallback } from 'react'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useFolderState } from '~/hooks/useFolderState'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useEditorNavigationContext } from '~/hooks/useEditorNavigationContext'
import { useIsSelectedItem } from '~/hooks/useSelectedItem'
import { getSidebarItemIcon } from '~/lib/category-icons'
import { EditorContextMenu } from '~/components/context-menu/components/EditorContextMenu'

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
  const { navigateToItem } = useEditorNavigationContext()
  const isSelected = useIsSelectedItem(item)
  const { toggleExpanded } = useFolderState(item._id)

  const icon = getSidebarItemIcon(item)

  const handleSelect = useCallback(
    () => navigateToItem(item),
    [navigateToItem, item],
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

  return (
    <DraggableSidebarItem item={item}>
      <EditorContextMenu ref={contextMenuRef} viewContext="sidebar" item={item}>
        <SidebarItemButtonBase
          icon={icon}
          name={item.name}
          isSelected={isSelected}
          isExpanded={isExpanded}
          isRenaming={renamingId === item._id}
          onSelect={handleSelect}
          onToggleExpanded={toggleExpanded}
          onMoreOptions={handleMoreOptions}
          onFinishRename={handleFinishRename}
          onCancelRename={handleCancelRename}
          showChevron={false}
          campaignId={item.campaignId}
          parentId={item.parentId ?? undefined}
          excludeId={item._id}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )
}

export const FlatSidebarItem = memo(FlatSidebarItemComponent)
