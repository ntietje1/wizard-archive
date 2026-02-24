import { memo, useCallback } from 'react'
import { defaultItemName } from 'convex/sidebarItems/functions/defaultItemName'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { Id } from 'convex/_generated/dataModel'
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
  ancestorIds: Array<Id<'folders'>>
  isExpanded: boolean
  renamingId: SidebarItemId | null
  setRenamingId: (id: SidebarItemId | null) => void
}

function FlatSidebarItemComponent({
  item,
  ancestorIds,
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
  const defaultName = defaultItemName(item)
  const displayName = item.name || defaultName

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
    <DraggableSidebarItem item={item} ancestorIds={ancestorIds}>
      <EditorContextMenu ref={contextMenuRef} viewContext="sidebar" item={item}>
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
