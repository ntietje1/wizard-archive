import { FolderDot, FolderOpenDot } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/features/sidebar/stores/sidebar-ui-store'

export function CloseAllFoldersButton() {
  const { campaignId } = useCampaign()
  const { closeAllFoldersMode } = useCampaignSidebarState(campaignId)
  const { toggleCloseAllFoldersMode } = useCampaignSidebarActions(campaignId)

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleCloseAllFoldersMode}
      data-state={closeAllFoldersMode ? 'active' : 'inactive'}
    >
      {closeAllFoldersMode ? (
        <FolderDot className="h-4 w-4" />
      ) : (
        <FolderOpenDot className="h-4 w-4" />
      )}
    </Button>
  )
}
