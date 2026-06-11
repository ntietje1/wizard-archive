import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { EditableName } from './editable-item-name'
import { SidebarShareButton } from './sidebar-item-share-button'
import type { AnySidebarItem } from 'shared/sidebar-items/model-types'
import type { Id } from 'convex/_generated/dataModel'
import { useEditFileSystemItem } from '~/features/filesystem/useEditFileSystemItem'
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
import {
  sidebarItemActionButtonClass,
  sidebarItemNameClass,
} from '~/features/sidebar/utils/sidebar-item-visual-state'
import { handleError } from '~/shared/utils/logger'
import type { SidebarWorkspaceItemSurfaceName } from '~/features/sidebar/workspace/sidebar-workspace-source'
import type { MouseEvent, Ref } from 'react'

interface SidebarLiveItemButtonProps {
  item: AnySidebarItem
  expanded: boolean
  indentLevel?: number
  onToggleExpanded?: (event: MouseEvent) => void
  renamingId: Id<'sidebarItems'> | null
  rowRef?: Ref<HTMLDivElement>
  setRenamingId: (id: Id<'sidebarItems'> | null) => void
  showChevron: boolean
  showShareButton?: boolean
  surface: SidebarWorkspaceItemSurfaceName
  visibleItemIds: Array<Id<'sidebarItems'>>
}

export function SidebarLiveItemButton({
  expanded,
  indentLevel,
  item,
  onToggleExpanded,
  renamingId,
  rowRef,
  setRenamingId,
  showChevron,
  showShareButton = false,
  surface,
  visibleItemIds,
}: SidebarLiveItemButtonProps) {
  const { editItem } = useEditFileSystemItem()
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const linkProps = useEditorLinkProps(item)
  const { setLastSelectedItem } = useLastEditorItem()
  const visualState = useSidebarItemVisualState(item)
  const isFocused = useIsFocusedItem(item)
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface,
    parentId: null,
    visibleItemIds,
  })

  const icon = getSidebarItemIcon(item)
  const isPending = isOptimisticSidebarItem(item)

  const selectItem = (event: MouseEvent) => {
    handleItemClick(event, () => setLastSelectedItem(item.slug))
  }

  const handleFinishRename = async (name: string) => {
    try {
      await editItem({ item, name })
      setRenamingId(null)
    } catch (error) {
      handleError(error, 'Failed to rename')
      setRenamingId(null)
    }
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
            expanded,
            renaming: renamingId === item._id,
            showChevron,
            pending: isPending,
            indentLevel,
          }}
          linkProps={linkProps}
          onClick={selectItem}
          onContextMenu={handleItemContextMenu}
          onToggleExpanded={showChevron ? onToggleExpanded : undefined}
          onMoreOptions={(event) => {
            handleItemContextMenu(event)
            handleMoreOptions(event)
          }}
          shareButton={
            showShareButton && !isPending ? (
              <SidebarShareButton
                item={item}
                buttonClassName={sidebarItemActionButtonClass(visualState)}
              />
            ) : null
          }
          rowRef={rowRef}
        />
      </EditorContextMenu>
    </DraggableSidebarItem>
  )
}
