import { FolderDot, FolderOpenDot } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/features/sidebar/stores/sidebar-ui-store'

export function CloseAllFoldersButton() {
  const { campaignId } = useCampaign()
  const { folderStates } = useCampaignSidebarState(campaignId)
  const { closeAllFolders } = useCampaignSidebarActions(campaignId)
  const hasOpenFolders = Object.values(folderStates).some(Boolean)

  return (
    <TooltipButton tooltip="Close all folders" side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={closeAllFolders}
        disabled={!hasOpenFolders}
        data-state={hasOpenFolders ? 'active' : 'inactive'}
        aria-label={hasOpenFolders ? 'Close all folders' : 'No open folders'}
      >
        {hasOpenFolders ? <FolderDot className="h-4 w-4" /> : <FolderOpenDot className="h-4 w-4" />}
      </Button>
    </TooltipButton>
  )
}
