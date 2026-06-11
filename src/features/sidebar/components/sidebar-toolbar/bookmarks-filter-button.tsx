import { Bookmark, BookmarkCheck } from 'lucide-react'
import { Button } from '~/features/shadcn/components/button'
import { TooltipButton } from '~/shared/components/tooltip-button'
import { useSidebarWorkspaceSource } from '~/features/sidebar/workspace/sidebar-workspace-source'

export function BookmarksFilterButton() {
  const {
    ui: { bookmarksOnlyMode },
    uiCommands: { toggleBookmarksOnlyMode },
  } = useSidebarWorkspaceSource()

  return (
    <TooltipButton tooltip={bookmarksOnlyMode ? 'Exit bookmarks' : 'Show bookmarks'} side="bottom">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleBookmarksOnlyMode}
        data-state={bookmarksOnlyMode ? 'active' : 'inactive'}
        aria-label={bookmarksOnlyMode ? 'Exit bookmarks' : 'Show bookmarks'}
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
