import type { FileSystemSelection } from '../../filesystem/selection'
import type { SidebarWorkspaceState } from './workspace-state'

export function createSidebarFileSystemSelection(
  sidebarWorkspaceState: SidebarWorkspaceState,
): FileSystemSelection {
  const { selectionCommands } = sidebarWorkspaceState
  const readSnapshot = () => selectionCommands.getSelectionSnapshot()

  return {
    get selectedItemIds() {
      return [...readSnapshot().selectedItemIds]
    },
    get anchorItemId() {
      return readSnapshot().anchorItemId
    },
    get focusedItemId() {
      return readSnapshot().focusedItemId
    },
    setSelectedItemIds: selectionCommands.setSelectedItemIds,
    selectSingleItem: selectionCommands.selectSingleItem,
    toggleItemSelection: selectionCommands.toggleItemSelection,
    selectItemRange: selectionCommands.selectItemRange,
    setFocusedItem: selectionCommands.setFocusedItem,
    moveFocus: selectionCommands.moveFocus,
    clearItemSelection: selectionCommands.clearItemSelection,
    normalizeContextSelection: selectionCommands.normalizeContextSelection,
    getSelectionSnapshot: () => {
      const { anchorItemId, focusedItemId, selectedItemIds } = readSnapshot()
      return { anchorItemId, focusedItemId, selectedItemIds: [...selectedItemIds] }
    },
  }
}
