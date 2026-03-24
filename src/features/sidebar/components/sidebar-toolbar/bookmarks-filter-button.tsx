import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/features/sidebar/stores/sidebar-ui-store'

export function BookmarksFilterButton() {
  const { campaignId } = useCampaign()
  const { bookmarksOnlyMode } = useCampaignSidebarState(campaignId)
  const { toggleBookmarksOnlyMode } = useCampaignSidebarActions(campaignId)

  return (
    <TooltipButton
      tooltip={bookmarksOnlyMode ? 'Exit bookmarks' : 'Show bookmarks'}
      side="bottom"
    >
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleBookmarksOnlyMode}
        data-state={bookmarksOnlyMode ? 'active' : 'inactive'}
      >
        {bookmarksOnlyMode ? (
          <BookmarkCheck className="h-4 w-4" />
        ) : (
          <Bookmark className="h-4 w-4" />
        )}
      </Button>
    </TooltipButton>
  )
}
