import { Bookmark } from 'lucide-react'
import { Button } from '~/components/shadcn/ui/button'
import { TooltipButton } from '~/components/tooltips/tooltip-button'
import { useCurrentItem } from '~/hooks/useCurrentItem'
import { useToggleBookmark } from '~/hooks/useBookmarks'
import { useCampaign } from '~/hooks/useCampaign'
import { cn } from '~/lib/shadcn/utils'

export function BookmarkButton() {
  const { item } = useCurrentItem()
  const { campaignWithMembership } = useCampaign()
  const campaignId = campaignWithMembership.data?.campaign._id
  const toggleBookmark = useToggleBookmark()

  const handleToggleBookmark = () => {
    if (!campaignId || !item) return
    toggleBookmark.mutate({
      campaignId,
      sidebarItemId: item._id,
      sidebarItemType: item.type,
    })
  }

  if (!item) return null

  const isBookmarked = item.isBookmarked ?? false
  const tooltip = isBookmarked ? 'Remove bookmark' : 'Add bookmark'

  return (
    <TooltipButton tooltip={tooltip}>
      <Button
        variant="ghost"
        size="icon"
        onClick={handleToggleBookmark}
        aria-label={tooltip}
      >
        <Bookmark
          className={cn(
            'h-4 w-4',
            isBookmarked && 'fill-current text-amber-500',
          )}
        />
      </Button>
    </TooltipButton>
  )
}
