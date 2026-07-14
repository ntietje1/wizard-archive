import type { ResourceId } from '../../../resources/domain-id'
import { useSidebarWorkspaceState } from '../workspace-state'

export function useFolderState(folderId: ResourceId) {
  const {
    ui: { closeAllFoldersMode, folderStates },
    uiCommands: { clearAllFolderStates, exitCloseAllMode, setFolderState, toggleFolderState },
  } = useSidebarWorkspaceState()

  const isExpanded = !closeAllFoldersMode && (folderStates[folderId] ?? false)

  const toggleExpanded = () => {
    if (closeAllFoldersMode) {
      setExpanded(true)
    } else {
      toggleFolderState(folderId)
    }
  }

  const setExpanded = (expanded: boolean) => {
    if (expanded && closeAllFoldersMode) {
      exitCloseAllMode()
      clearAllFolderStates()
    }
    setFolderState(folderId, expanded)
  }

  const openFolder = () => {
    setExpanded(true)
  }

  const closeFolder = () => {
    setExpanded(false)
  }

  return {
    isExpanded,
    toggleExpanded,
    setExpanded,
    openFolder,
    closeFolder,
  }
}
