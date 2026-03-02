import { memo, useCallback } from 'react'
import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import type { AnySidebarItem } from 'convex/sidebarItems/types/types'
import type { SidebarItemId } from 'convex/sidebarItems/types/baseTypes'
import { useRenameItem } from '~/hooks/useRenameItem'
import { useFolderState } from '~/hooks/useFolderState'
import { useContextMenu } from '~/hooks/useContextMenu'
import { useEditorLinkProps } from '~/hooks/useEditorLinkProps'
import { useLastEditorItem } from '~/hooks/useLastEditorItem'
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
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const isSelected = useIsSelectedItem(item)
  const { toggleExpanded } = useFolderState(item._id)

  const icon = getSidebarItemIcon(item)

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
