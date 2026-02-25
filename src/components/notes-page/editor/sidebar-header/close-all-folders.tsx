import { Button } from '~/components/shadcn/ui/button'
import { FolderDot, FolderOpenDot } from '~/lib/icons'
import { useCampaign } from '~/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/stores/sidebarUIStore'

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
