import { useCallback } from 'react'
import { useCampaign } from '~/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/stores/sidebarUIStore'

export function useFolderState(folderId: string) {
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id

  const { folderStates, closeAllFoldersMode } =
    useCampaignSidebarState(campaignId)

  const {
    setFolderState,
    toggleFolderState,
    exitCloseAllMode,
    clearAllFolderStates,
  } = useCampaignSidebarActions(campaignId)

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
