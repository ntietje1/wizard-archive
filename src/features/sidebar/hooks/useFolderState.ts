import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/features/sidebar/stores/sidebar-ui-store'

export function useFolderState(folderId: string) {
  const { campaignId } = useCampaign()

  const { folderStates, closeAllFoldersMode } =
    useCampaignSidebarState(campaignId)

  const {
    setFolderState,
    toggleFolderState,
    exitCloseAllMode,
    clearAllFolderStates,
  } = useCampaignSidebarActions(campaignId)

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
