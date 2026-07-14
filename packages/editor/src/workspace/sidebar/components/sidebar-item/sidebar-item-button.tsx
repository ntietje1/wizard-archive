import { SidebarItemButtonBase } from './sidebar-item-button-base'
import { DraggableSidebarItem } from './draggable-sidebar-item'
import { EditableName } from './editable-item-name'
import { SidebarShareButton } from './sidebar-item-share-button'
import type { SidebarItemId } from '../../../../../../../shared/common/ids'
import type { AnyItem } from '../../../items'
import { useContextMenu } from '../../../../context-menu/hooks/use-context-menu'
import { useSidebarItemVisualState } from '../../use-sidebar-item-visual-state'
import { getSidebarItemIcon } from '../../item-icons'
import { WorkspaceContextMenu } from '../../../context-menu/context-menu'
import { useItemSelectionInteractions } from '../../use-item-selection-interactions'
import { isOptimisticSidebarItem } from '../../../items/optimistic'
import { sidebarItemActionButtonClass, sidebarItemNameClass } from '../../item-visual-state'
import { createWorkspaceResource } from '../../../runtime'
import type { SidebarWorkspaceItemSurfaceName } from '../../workspace-state'
import type { MouseEvent, Ref } from 'react'
import type { SidebarItemSource } from '../sidebar-tree-source'

interface SidebarItemButtonContainerProps {
  item: AnyItem
  expanded: boolean
  indentLevel?: number
  onToggleExpanded?: (event: MouseEvent) => void
  renamingId: SidebarItemId | null
  rowRef?: Ref<HTMLDivElement>
  setRenamingId: (id: SidebarItemId | null) => void
  showChevron: boolean
  showShareButton?: boolean
  source: SidebarItemSource
  surface: SidebarWorkspaceItemSurfaceName
  visibleItemIds: ReadonlyArray<SidebarItemId>
}

export function SidebarItemButton({
  expanded,
  indentLevel,
  item,
  onToggleExpanded,
  renamingId,
  rowRef,
  setRenamingId,
  showChevron,
  showShareButton = false,
  source,
  surface,
  visibleItemIds,
}: SidebarItemButtonContainerProps) {
  const { contextMenuRef, handleMoreOptions } = useContextMenu()
  const visualState = useSidebarItemVisualState(item, source.currentItemId)
  const { handleItemClick, handleItemContextMenu } = useItemSelectionInteractions(item, {
    surface,
    parentId: item.parentId,
    visibleItemIds,
  })
  const itemActionsEnabled = source.canUseItemActions(item)

  const icon = getSidebarItemIcon(item)
  const isPending = isOptimisticSidebarItem(item)
  const isRenaming = renamingId === item.id
  const shareButtonSource = source.shareButtonSource

  const selectItem = (event: MouseEvent) => {
    handleItemClick(event, () => {
      void source.openItem(createWorkspaceResource(item.id))
    })
  }

  const handleFinishRename = async (name: string) => {
    await source.editItem({ item, name })
    setRenamingId(null)
  }

  const handleCancelRename = () => {
    setRenamingId(null)
  }

  return (
    <DraggableSidebarItem
      item={item}
      canDrag={source.canDragItem(item)}
      disabled={isPending}
      dragDataSource={source}
    >
      <WorkspaceContextMenu
        ref={contextMenuRef}
        viewContext="sidebar"
        item={item}
        disabled={isRenaming || isPending || !itemActionsEnabled}
      >
        <SidebarItemButtonBase
          icon={icon}
          itemId={item.id}
          name={item.name}
          nameContent={
            <EditableName
              initialName={item.name}
              isRenaming={isRenaming}
              onFinishRename={handleFinishRename}
              onCancelRename={handleCancelRename}
              displayClassName={sidebarItemNameClass(visualState)}
            />
          }
          presentation={{
            visualState,
            expanded,
            renaming: isRenaming,
            showChevron,
            pending: isPending,
            indentLevel,
          }}
          onClick={selectItem}
          onContextMenu={isRenaming ? undefined : handleItemContextMenu}
          onToggleExpanded={showChevron ? onToggleExpanded : undefined}
          onMoreOptions={
            itemActionsEnabled && !isPending
              ? (event) => {
                  handleItemContextMenu(event)
                  handleMoreOptions(event)
                }
              : undefined
          }
          shareButton={
            showShareButton && !isPending && shareButtonSource ? (
              <SidebarShareButton
                item={item}
                source={shareButtonSource}
                buttonClassName={sidebarItemActionButtonClass(visualState)}
              />
            ) : null
          }
          rowRef={rowRef}
        />
      </WorkspaceContextMenu>
    </DraggableSidebarItem>
  )
}
