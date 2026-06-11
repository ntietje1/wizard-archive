import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

export function useFolderState(folderId: string) {
  const {
    ui: { closeAllFoldersMode, folderStates },
    uiCommands: { clearAllFolderStates, exitCloseAllMode, setFolderState, toggleFolderState },
  } = useSidebarWorkspaceSource()

  const isExpanded = !closeAllFoldersMode && (folderStates[folderId] ?? false)

  const toggleExpanded = () => {
    if (closeAllFoldersMode) {
      exitCloseAllMode()
      clearAllFolderStates()
      setFolderState(folderId, true)
    } else {
      toggleFolderState(folderId)
    }
  }

  const setExpanded = (expanded: boolean) => {
    setFolderState(folderId, expanded)
  }

  const openFolder = () => {
    setFolderState(folderId, true)
  }

  const closeFolder = () => {
    setFolderState(folderId, false)
  }

  return {
    isExpanded,
    toggleExpanded,
    setExpanded,
    openFolder,
    closeFolder,
  }
}
