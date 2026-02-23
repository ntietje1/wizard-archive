import { Button } from '~/components/shadcn/ui/button'
import { Bookmark, BookmarkCheck } from '~/lib/icons'
import { useCampaign } from '~/hooks/useCampaign'
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
