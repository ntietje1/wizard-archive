import { Button } from '~/features/shadcn/components/button'
import { Bookmark, BookmarkCheck } from '~/features/shared/utils/icons'
import { useCampaign } from '~/features/campaigns/hooks/useCampaign'
import {
  useCampaignSidebarActions,
  useCampaignSidebarState,
} from '~/stores/sidebarUIStore'

export function BookmarksFilterButton() {
  const { campaignId } = useCampaign()
  const { bookmarksOnlyMode } = useCampaignSidebarState(campaignId)
  const { toggleBookmarksOnlyMode } = useCampaignSidebarActions(campaignId)

  return (
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
  )
}
