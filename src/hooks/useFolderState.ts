import { useCallback } from 'react'
import { useFileSidebar } from '~/hooks/useFileSidebar'

export function useFolderState(folderId: string) {
  const {
    folderStates,
    setFolderState,
    toggleFolderState,
    closeAllFoldersMode,
    exitCloseAllMode,
    clearAllFolderStates,
  } = useFileSidebar()

  const isExpanded = !closeAllFoldersMode && (folderStates[folderId] ?? false)

  const toggleExpanded = useCallback(() => {
    if (closeAllFoldersMode) {
      exitCloseAllMode()
      clearAllFolderStates()
      setFolderState(folderId, true)
    } else {
      toggleFolderState(folderId)
    }
  }, [
    folderId,
    toggleFolderState,
    setFolderState,
    closeAllFoldersMode,
    exitCloseAllMode,
    clearAllFolderStates,
  ])

  const setExpanded = useCallback(
    (expanded: boolean) => {
      setFolderState(folderId, expanded)
    },
    [folderId, setFolderState],
  )

  const openFolder = useCallback(() => {
    setFolderState(folderId, true)
  }, [folderId, setFolderState])

  const closeFolder = useCallback(() => {
    setFolderState(folderId, false)
  }, [folderId, setFolderState])

  return {
    isExpanded,
    toggleExpanded,
    setExpanded,
    openFolder,
    closeFolder,
  }
}
